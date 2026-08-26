from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import os
from uuid import uuid4


CURRENT_PATH = "admin/card-descriptions.json"
HISTORY_PREFIX = "admin/history/"
DESCRIPTION_FIELDS = ("received", "concluded", "balance", "stock", "time")
DEFAULT_DESCRIPTIONS = {
    "received": "Demandas que entraram na SEPLAN durante o período selecionado.",
    "concluded": "Produção entregue, incluindo conclusões operacionais reconhecidas.",
    "balance": "Diferença entre entradas e conclusões; saldo positivo pressiona o estoque.",
    "stock": "Pendências existentes na data final do recorte, independentemente da abertura.",
    "time": "Tempo entre abertura e conclusão dos processos entregues no período.",
}


class AdminStoreError(Exception):
    def __init__(self, status: int, public_message: str):
        super().__init__(public_message)
        self.status = status
        self.public_message = public_message


def _blob_configured() -> bool:
    return bool(os.getenv("BLOB_READ_WRITE_TOKEN"))


def _blob_client():
    try:
        from vercel.blob import BlobClient
    except ImportError as exc:
        raise AdminStoreError(503, "Armazenamento administrativo indisponível no servidor.") from exc
    return BlobClient()


def _read_blob(path: str) -> bytes | None:
    try:
        from vercel.blob.errors import BlobNotFoundError
        with _blob_client() as client:
            result = client.get(path, access="private", timeout=5, use_cache=False)
    except BlobNotFoundError:
        return None
    except AdminStoreError:
        raise
    except Exception as exc:
        raise AdminStoreError(503, "Armazenamento administrativo temporariamente indisponível.") from exc
    if result is None or result.status_code == 404:
        return None
    if result.status_code != 200:
        raise AdminStoreError(503, "Armazenamento administrativo recusou a leitura.")
    return bytes(result.content)


def _write_blob(path: str, body: bytes, *, overwrite: bool) -> None:
    try:
        with _blob_client() as client:
            client.put(
                path,
                body,
                access="private",
                content_type="application/json; charset=utf-8",
                overwrite=overwrite,
            )
    except AdminStoreError:
        raise
    except Exception as exc:
        raise AdminStoreError(503, "Armazenamento administrativo recusou a gravação.") from exc


def _delete_blob(path: str) -> None:
    try:
        with _blob_client() as client:
            client.delete(path)
    except Exception:
        # Limpeza de tentativa/histórico não pode invalidar uma gravação já confirmada.
        return


def _prune_history(limit: int = 20) -> None:
    try:
        with _blob_client() as client:
            items = client.list_objects(prefix=HISTORY_PREFIX, limit=100).blobs
            excess = sorted(items, key=lambda item: item.uploaded_at, reverse=True)[limit:]
            if excess:
                client.delete([item.url for item in excess])
    except Exception:
        # O histórico é contingência; o arquivo vigente continua sendo a fonte de leitura.
        return


def _validate_descriptions(raw) -> dict[str, str]:
    if not isinstance(raw, dict):
        raise AdminStoreError(400, "Descrições inválidas.")
    if set(raw) != set(DESCRIPTION_FIELDS):
        raise AdminStoreError(400, "O conjunto de descrições não corresponde aos cinco cards autorizados.")
    output = {}
    for field in DESCRIPTION_FIELDS:
        value = str(raw.get(field, "")).strip()
        if not value or len(value) > 180:
            raise AdminStoreError(400, f"A descrição de {field} deve ter entre 1 e 180 caracteres.")
        output[field] = value
    return output


def _decode_document(raw: bytes, invalid_message: str) -> dict:
    try:
        document = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, AttributeError) as exc:
        raise AdminStoreError(503, invalid_message) from exc
    if not isinstance(document, dict):
        raise AdminStoreError(503, invalid_message)
    return document


def load_descriptions() -> dict:
    if not _blob_configured():
        return {
            "ok": True,
            "descriptions": DEFAULT_DESCRIPTIONS,
            "updated_at": None,
            "persistent": False,
        }
    raw = _read_blob(CURRENT_PATH)
    if raw is None:
        return {
            "ok": True,
            "descriptions": DEFAULT_DESCRIPTIONS,
            "updated_at": None,
            "persistent": True,
        }
    stored = _decode_document(raw, "A configuração administrativa armazenada está inválida.")
    descriptions = _validate_descriptions(stored.get("descriptions"))
    return {
        "ok": True,
        "descriptions": descriptions,
        "updated_at": stored.get("updated_at"),
        "persistent": True,
    }


def _attempt_path(client_ip: str) -> str:
    digest = hashlib.sha256((client_ip or "unknown").encode("utf-8")).hexdigest()[:24]
    return f"admin/attempts/{digest}.json"


def _load_attempts(path: str, now: datetime) -> int:
    raw = _read_blob(path)
    if raw is None:
        return 0
    document = _decode_document(raw, "Controle de acesso temporariamente indisponível.")
    try:
        expires_at = datetime.fromisoformat(str(document["expires_at"]))
        attempts = int(document["attempts"])
    except (KeyError, TypeError, ValueError) as exc:
        raise AdminStoreError(503, "Controle de acesso temporariamente indisponível.") from exc
    if expires_at <= now:
        _delete_blob(path)
        return 0
    return max(0, attempts)


def _register_failed_attempt(path: str, attempts: int, now: datetime) -> None:
    document = {
        "attempts": attempts + 1,
        "expires_at": (now + timedelta(minutes=10)).replace(microsecond=0).isoformat(),
    }
    _write_blob(path, json.dumps(document, separators=(",", ":")).encode("utf-8"), overwrite=True)


def save_descriptions(raw_descriptions, password: str, client_ip: str) -> dict:
    expected = os.getenv("SEPLAN_ADMIN_PASSWORD")
    if not expected:
        raise AdminStoreError(503, "Senha administrativa ainda não configurada.")
    if not _blob_configured():
        raise AdminStoreError(503, "Armazenamento administrativo ainda não configurado.")

    now = datetime.now(timezone.utc)
    attempt_path = _attempt_path(client_ip)
    attempts = _load_attempts(attempt_path, now)
    if attempts >= 5:
        raise AdminStoreError(429, "Muitas tentativas inválidas. Aguarde dez minutos.")

    if not hmac.compare_digest(str(password or ""), expected):
        _register_failed_attempt(attempt_path, attempts, now)
        raise AdminStoreError(401, "Senha de gravação inválida.")

    descriptions = _validate_descriptions(raw_descriptions)
    updated_at = now.replace(microsecond=0).isoformat()
    stored = json.dumps(
        {"descriptions": descriptions, "updated_at": updated_at},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")

    # O histórico é escrito antes do arquivo vigente. Se a última etapa falhar,
    # a configuração anterior continua íntegra e a tentativa fica auditável.
    history_path = f"{HISTORY_PREFIX}{now.strftime('%Y%m%dT%H%M%S')}-{uuid4().hex[:8]}.json"
    _write_blob(history_path, stored, overwrite=False)
    _write_blob(CURRENT_PATH, stored, overwrite=True)
    _delete_blob(attempt_path)
    _prune_history()
    return {"ok": True, "descriptions": descriptions, "updated_at": updated_at, "persistent": True}
