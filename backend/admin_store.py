from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import os
from pathlib import Path
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COPY_PATH = ROOT / "src" / "content" / "dashboard-copy.json"
CURRENT_PATH = "admin/dashboard-copy.json"
HISTORY_PREFIX = "admin/content-history/"
LEGACY_PATH = "admin/card-descriptions.json"
MAX_TEXT_LENGTH = 600
MAX_DOCUMENT_BYTES = 64_000
SESSION_TTL_SECONDS = 30 * 60


class AdminStoreError(Exception):
    def __init__(self, status: int, public_message: str):
        super().__init__(public_message)
        self.status = status
        self.public_message = public_message


def _load_default_copy() -> dict:
    try:
        document = json.loads(DEFAULT_COPY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AdminStoreError(503, "Catálogo editorial padrão indisponível no servidor.") from exc
    if not isinstance(document, dict):
        raise AdminStoreError(503, "Catálogo editorial padrão inválido.")
    return document


DEFAULT_COPY = _load_default_copy()
DEFAULT_DESCRIPTIONS = {
    "received": DEFAULT_COPY["overview"]["cards"]["received"]["description"],
    "concluded": DEFAULT_COPY["overview"]["cards"]["outputs"]["description"],
    "balance": DEFAULT_COPY["overview"]["cards"]["balance"]["description"],
    "stock": DEFAULT_COPY["overview"]["cards"]["stock"]["description"],
    "time": DEFAULT_COPY["overview"]["cards"]["time"]["description"],
}


def _blob_configured() -> bool:
    return bool(os.getenv("BLOB_READ_WRITE_TOKEN"))


def _admin_secret() -> str:
    secret = os.getenv("SEPLAN_ADMIN_PASSWORD")
    if not secret:
        raise AdminStoreError(503, "Senha administrativa ainda não configurada.")
    return secret


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
        return


def _prune_history(limit: int = 20) -> None:
    try:
        with _blob_client() as client:
            items = client.list_objects(prefix=HISTORY_PREFIX, limit=100).blobs
            excess = sorted(items, key=lambda item: item.uploaded_at, reverse=True)[limit:]
            if excess:
                client.delete([item.url for item in excess])
    except Exception:
        return


def _validate_copy(raw, template=None, path: str = ""):
    if template is None:
        template = DEFAULT_COPY
    if isinstance(template, dict):
        if not isinstance(raw, dict):
            raise AdminStoreError(400, f"Estrutura editorial inválida em {path or 'raiz'}.")
        if set(raw) != set(template):
            raise AdminStoreError(400, f"Campos editoriais divergentes em {path or 'raiz'}.")
        return {
            key: _validate_copy(raw[key], template[key], f"{path}.{key}" if path else key)
            for key in template
        }
    if not isinstance(template, str):
        raise AdminStoreError(503, "Contrato editorial padrão contém tipo não autorizado.")
    value = str(raw if raw is not None else "").strip()
    if not value or len(value) > MAX_TEXT_LENGTH:
        raise AdminStoreError(400, f"O texto {path} deve ter entre 1 e {MAX_TEXT_LENGTH} caracteres.")
    return value


def _decode_document(raw: bytes, invalid_message: str) -> dict:
    try:
        document = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, AttributeError) as exc:
        raise AdminStoreError(503, invalid_message) from exc
    if not isinstance(document, dict):
        raise AdminStoreError(503, invalid_message)
    return document


def _migrate_legacy_descriptions() -> dict | None:
    raw = _read_blob(LEGACY_PATH)
    if raw is None:
        return None
    document = _decode_document(raw, "Configuração editorial legada inválida.")
    descriptions = document.get("descriptions")
    if not isinstance(descriptions, dict):
        return None
    migrated = deepcopy(DEFAULT_COPY)
    mapping = {
        "received": "received",
        "concluded": "outputs",
        "balance": "balance",
        "stock": "stock",
        "time": "time",
    }
    for old_key, card_key in mapping.items():
        value = descriptions.get(old_key)
        if isinstance(value, str) and value.strip():
            migrated["overview"]["cards"][card_key]["description"] = value.strip()
    return migrated


def load_copy() -> dict:
    if not _blob_configured():
        return {
            "ok": True,
            "copy": deepcopy(DEFAULT_COPY),
            "updated_at": None,
            "persistent": False,
        }
    raw = _read_blob(CURRENT_PATH)
    if raw is None:
        migrated = _migrate_legacy_descriptions()
        return {
            "ok": True,
            "copy": _validate_copy(migrated or deepcopy(DEFAULT_COPY)),
            "updated_at": None,
            "persistent": True,
        }
    stored = _decode_document(raw, "A configuração editorial armazenada está inválida.")
    copy = _validate_copy(stored.get("copy"))
    return {
        "ok": True,
        "copy": copy,
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


def _authorize_password(password: str, client_ip: str) -> None:
    expected = _admin_secret()
    now = datetime.now(timezone.utc)
    attempt_path = _attempt_path(client_ip)
    attempts = _load_attempts(attempt_path, now) if _blob_configured() else 0
    if attempts >= 5:
        raise AdminStoreError(429, "Muitas tentativas inválidas. Aguarde dez minutos.")
    if not hmac.compare_digest(str(password or ""), expected):
        if _blob_configured():
            _register_failed_attempt(attempt_path, attempts, now)
        raise AdminStoreError(401, "Senha administrativa inválida.")
    if _blob_configured():
        _delete_blob(attempt_path)


def create_admin_session(password: str, client_ip: str) -> str:
    """Valida a senha somente no servidor e devolve um token assinado de curta duração.

    O token não contém a senha e deve ser enviado ao navegador somente como cookie HttpOnly.
    """
    _authorize_password(password, client_ip)
    secret = _admin_secret().encode("utf-8")
    expires = int(datetime.now(timezone.utc).timestamp()) + SESSION_TTL_SECONDS
    nonce = uuid4().hex
    payload = f"{expires}.{nonce}"
    signature = hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def validate_admin_session(token: str | None) -> bool:
    if not token:
        return False
    try:
        expires_raw, nonce, supplied_signature = token.split(".", 2)
        expires = int(expires_raw)
    except (ValueError, AttributeError):
        return False
    now = int(datetime.now(timezone.utc).timestamp())
    if expires <= now or expires > now + SESSION_TTL_SECONDS + 60:
        return False
    try:
        secret = _admin_secret().encode("utf-8")
    except AdminStoreError:
        return False
    payload = f"{expires}.{nonce}"
    expected_signature = hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(supplied_signature, expected_signature)


def save_copy(raw_copy, password: str = "", client_ip: str = "", session_token: str | None = None) -> dict:
    if not _blob_configured():
        raise AdminStoreError(503, "Armazenamento administrativo ainda não configurado.")
    if not validate_admin_session(session_token):
        _authorize_password(password, client_ip)

    now = datetime.now(timezone.utc)
    copy = _validate_copy(raw_copy)
    updated_at = now.replace(microsecond=0).isoformat()
    stored = json.dumps(
        {"copy": copy, "updated_at": updated_at},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    if len(stored) > MAX_DOCUMENT_BYTES:
        raise AdminStoreError(400, "O catálogo editorial excede o limite permitido.")

    history_path = f"{HISTORY_PREFIX}{now.strftime('%Y%m%dT%H%M%S')}-{uuid4().hex[:8]}.json"
    _write_blob(history_path, stored, overwrite=False)
    _write_blob(CURRENT_PATH, stored, overwrite=True)
    _prune_history()
    return {"ok": True, "copy": copy, "updated_at": updated_at, "persistent": True}


# Compatibilidade temporária para chamadas antigas durante o rollout.
def load_descriptions() -> dict:
    data = load_copy()
    cards = data["copy"]["overview"]["cards"]
    return {
        "ok": True,
        "descriptions": {
            "received": cards["received"]["description"],
            "concluded": cards["outputs"]["description"],
            "balance": cards["balance"]["description"],
            "stock": cards["stock"]["description"],
            "time": cards["time"]["description"],
        },
        "updated_at": data["updated_at"],
        "persistent": data["persistent"],
    }


def save_descriptions(raw_descriptions, password: str, client_ip: str, session_token: str | None = None) -> dict:
    base = load_copy()["copy"]
    if not isinstance(raw_descriptions, dict):
        raise AdminStoreError(400, "Descrições inválidas.")
    mapping = {
        "received": "received",
        "concluded": "outputs",
        "balance": "balance",
        "stock": "stock",
        "time": "time",
    }
    for old_key, card_key in mapping.items():
        value = str(raw_descriptions.get(old_key, "")).strip()
        if not value:
            raise AdminStoreError(400, f"Descrição inválida: {old_key}.")
        base["overview"]["cards"][card_key]["description"] = value
    saved = save_copy(base, password, client_ip, session_token=session_token)
    return load_descriptions() | {"updated_at": saved["updated_at"], "persistent": saved["persistent"]}
