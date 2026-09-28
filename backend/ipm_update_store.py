from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from io import BytesIO
import hashlib
import json
import os
from pathlib import Path
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

from openpyxl import load_workbook


RAW_PREFIX = "ipm/raw/"
RUN_PREFIX = "ipm/runs/"
RUN_INDEX_PATH = "ipm/runs/index.json"
MAX_HISTORY = 30
LOCAL_TZ = ZoneInfo("America/Sao_Paulo")

HEADER_ALIASES = {
    "protocol": ("Número/Ano", "Protocolo"),
    "opened": ("Abertura - Data", "DataAbertura"),
    "moved": ("Último Trâmite - Data/Hora", "DataUltTramite", "UltTramiteData"),
    "closed": ("Data Encerramento", "DataEncerramento"),
    "situation": ("Situação",),
    "subject": ("Subassunto - Descrição", "Assunto", "Categoria"),
    "sector": ("Centro de Custo Atual - Descrição", "CCAtual"),
}
REQUIRED_FIELDS = {"protocol", "opened", "moved", "situation", "subject", "sector"}


class IPMUpdateError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.public_message = message


def _blob_client():
    try:
        from vercel.blob import BlobClient
    except ImportError as exc:
        raise IPMUpdateError(503, "Armazenamento da atualização IPM indisponível.") from exc
    if not os.getenv("BLOB_READ_WRITE_TOKEN"):
        raise IPMUpdateError(503, "Armazenamento da atualização IPM não está configurado.")
    return BlobClient()


def _read_blob(path: str) -> bytes | None:
    try:
        from vercel.blob.errors import BlobNotFoundError
        with _blob_client() as client:
            result = client.get(path, access="private", timeout=8, use_cache=False)
    except BlobNotFoundError:
        return None
    except IPMUpdateError:
        raise
    except Exception as exc:
        raise IPMUpdateError(503, "Não foi possível consultar o armazenamento da atualização.") from exc
    if result is None or result.status_code == 404:
        return None
    if result.status_code != 200:
        raise IPMUpdateError(503, "O armazenamento recusou a leitura da atualização.")
    return bytes(result.content)


def _write_blob(path: str, body: bytes, content_type: str, *, overwrite: bool) -> None:
    try:
        with _blob_client() as client:
            client.put(path, body, access="private", content_type=content_type, overwrite=overwrite)
    except IPMUpdateError:
        raise
    except Exception as exc:
        raise IPMUpdateError(503, "Não foi possível salvar a atualização no armazenamento privado.") from exc


def _json_blob(path: str, default):
    raw = _read_blob(path)
    if raw is None:
        return default
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise IPMUpdateError(503, "Histórico de atualização IPM inválido.") from exc


def _write_json(path: str, payload: dict, *, overwrite: bool = True) -> None:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    _write_blob(path, body, "application/json; charset=utf-8", overwrite=overwrite)


def _clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _parse_protocol(value: Any) -> str:
    text = _clean(value)
    sep = "/" if "/" in text else "-" if "-" in text else ""
    if not sep:
        return ""
    left, right = text.rsplit(sep, 1)
    try:
        a, b = int(left.strip()), int(right.strip())
    except ValueError:
        return ""
    if sep == "/":
        number, year = a, b
    elif 2000 <= a <= 2100:
        year, number = a, b
    else:
        number, year = a, b
    if not (2025 <= year <= 2100) or number <= 0:
        return ""
    return f"{year}-{number}"


def _as_datetime(value: Any, *, allow_sentinel: bool = False) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, time.min)
    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric < 30000:
            return None if allow_sentinel else None
        return datetime(1899, 12, 30) + timedelta(days=numeric)
    text = _clean(value)
    if not text:
        return None
    try:
        numeric = float(text.replace(",", "."))
        if numeric < 30000:
            return None
        return datetime(1899, 12, 30) + timedelta(days=numeric)
    except ValueError:
        pass
    for fmt in (
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(text[:19], fmt)
        except ValueError:
            continue
    return None


def _find_header(sheet) -> tuple[dict[str, int], int, list[str]]:
    for row_no, values in enumerate(sheet.iter_rows(min_row=1, max_row=12, values_only=True), start=1):
        headers = [_clean(value) for value in values]
        positions: dict[str, int] = {}
        for field, aliases in HEADER_ALIASES.items():
            for alias in aliases:
                if alias in headers:
                    positions[field] = headers.index(alias)
                    break
        if REQUIRED_FIELDS.issubset(positions):
            return positions, row_no, headers
    raise IPMUpdateError(
        400,
        "Estrutura do relatório não reconhecida. Os campos essenciais do relatório IPM não foram encontrados.",
    )


def _value(values: tuple, index: int | None):
    if index is None or index >= len(values):
        return None
    return values[index]


def validate_ipm_xlsx(body: bytes) -> dict[str, Any]:
    if not body:
        raise IPMUpdateError(400, "O arquivo enviado está vazio.")
    try:
        workbook = load_workbook(BytesIO(body), read_only=True, data_only=True)
    except Exception as exc:
        raise IPMUpdateError(400, "O arquivo não é uma planilha XLSX válida.") from exc
    try:
        if "Report" not in workbook.sheetnames:
            raise IPMUpdateError(400, "A aba Report não foi encontrada no relatório IPM.")
        sheet = workbook["Report"]
        positions, header_row, headers = _find_header(sheet)
        seen: set[str] = set()
        duplicates: list[str] = []
        invalid_rows = 0
        invalid_dates = 0
        sentinels_ignored = 0
        latest_movement: datetime | None = None
        rows = 0

        for values in sheet.iter_rows(min_row=header_row + 1, values_only=True):
            if not any(_clean(value) for value in values):
                continue
            protocol = _parse_protocol(_value(values, positions.get("protocol")))
            if not protocol:
                invalid_rows += 1
                continue
            rows += 1
            if protocol in seen:
                duplicates.append(protocol)
                continue
            seen.add(protocol)

            opened_raw = _value(values, positions.get("opened"))
            moved_raw = _value(values, positions.get("moved"))
            opened = _as_datetime(opened_raw)
            moved = _as_datetime(moved_raw)
            if opened is None or moved is None or moved < opened:
                invalid_dates += 1
                continue
            if latest_movement is None or moved > latest_movement:
                latest_movement = moved

            closed_idx = positions.get("closed")
            if closed_idx is not None:
                closed_raw = _value(values, closed_idx)
                closed_text = _clean(closed_raw)
                closed = _as_datetime(closed_raw, allow_sentinel=True)
                if closed_text and closed is None and closed_text.replace(",", ".").replace(".", "", 1).isdigit():
                    sentinels_ignored += 1
                if closed is not None and closed < opened:
                    invalid_dates += 1

        if invalid_rows:
            raise IPMUpdateError(400, f"O relatório contém {invalid_rows} linha(s) com protocolo inválido.")
        if duplicates:
            raise IPMUpdateError(400, f"O relatório contém {len(duplicates)} protocolo(s) duplicado(s).")
        if invalid_dates:
            raise IPMUpdateError(400, f"O relatório contém {invalid_dates} inconsistência(s) de data.")
        if not seen or latest_movement is None:
            raise IPMUpdateError(400, "Nenhum protocolo válido foi encontrado no relatório.")

        return {
            "rows": rows,
            "unique_protocols": len(seen),
            "duplicates": 0,
            "latest_movement": latest_movement.isoformat(sep=" ", timespec="seconds"),
            "source_sheet": "Report",
            "source_columns": len([header for header in headers if header]),
            "date_sentinels_ignored": sentinels_ignored,
        }
    finally:
        workbook.close()


def _steps() -> list[dict[str, str]]:
    return [
        {"id": "received", "label": "Arquivo recebido", "status": "done"},
        {"id": "stored", "label": "Original armazenado", "status": "done"},
        {"id": "validated", "label": "Estrutura e integridade validadas", "status": "done"},
        {"id": "snapshot", "label": "Snapshot diário registrado", "status": "done"},
        {"id": "comparison", "label": "Comparação com a base anterior", "status": "pending"},
        {"id": "events", "label": "Identificação de movimentações", "status": "pending"},
        {"id": "indicators", "label": "Recálculo dos indicadores", "status": "pending"},
        {"id": "preview", "label": "Validação em pré-produção", "status": "pending"},
        {"id": "publication", "label": "Publicação do BI", "status": "blocked"},
    ]


def _load_index() -> list[dict]:
    payload = _json_blob(RUN_INDEX_PATH, {"v": 1, "runs": []})
    runs = payload.get("runs", []) if isinstance(payload, dict) else []
    return runs if isinstance(runs, list) else []


def _save_index(runs: list[dict]) -> None:
    _write_json(RUN_INDEX_PATH, {"v": 1, "runs": runs[:MAX_HISTORY]}, overwrite=True)


def list_ipm_imports(limit: int = 10) -> dict[str, Any]:
    limit = max(1, min(30, int(limit)))
    runs = _load_index()[:limit]
    return {"ok": True, "runs": runs, "count": len(runs)}


def get_ipm_import(run_id: str) -> dict[str, Any]:
    safe = "".join(ch for ch in _clean(run_id) if ch.isalnum() or ch in "-_")
    if not safe or safe != _clean(run_id):
        raise IPMUpdateError(400, "Identificador de atualização inválido.")
    payload = _json_blob(f"{RUN_PREFIX}{safe}.json", None)
    if not isinstance(payload, dict):
        raise IPMUpdateError(404, "Atualização IPM não encontrada.")
    return {"ok": True, "run": payload}


def create_ipm_import(body: bytes, source_name: str = "") -> dict[str, Any]:
    if not _clean(source_name).lower().endswith(".xlsx"):
        raise IPMUpdateError(400, "Selecione um arquivo XLSX do relatório IPM.")

    validation = validate_ipm_xlsx(body)
    digest = hashlib.sha256(body).hexdigest()
    now_utc = datetime.now(timezone.utc).replace(microsecond=0)
    now_local = now_utc.astimezone(LOCAL_TZ)
    canonical_name = f"BASEIPM_{now_local.strftime('%d%m%Y')}.xlsx"
    raw_path = f"{RAW_PREFIX}{now_local.strftime('%Y/%m')}/{canonical_name}"

    existing = _read_blob(raw_path)
    if existing is not None:
        existing_digest = hashlib.sha256(existing).hexdigest()
        if existing_digest != digest:
            raise IPMUpdateError(
                409,
                f"Já existe uma base para {now_local.strftime('%d/%m/%Y')} com conteúdo diferente. A substituição foi bloqueada.",
            )
        for item in _load_index():
            if item.get("sha256") == digest and item.get("canonical_name") == canonical_name:
                return {"ok": True, "duplicate": True, "run": item}

    if existing is None:
        _write_blob(
            raw_path,
            body,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            overwrite=False,
        )

    run_id = f"{now_local.strftime('%Y%m%dT%H%M%S')}-{digest[:8]}"
    run = {
        "id": run_id,
        "status": "PREPARED",
        "phase": "VALIDATION_COMPLETE",
        "created_at": now_utc.isoformat(),
        "local_created_at": now_local.isoformat(),
        "source_name": _clean(source_name)[:180],
        "canonical_name": canonical_name,
        "sha256": digest,
        "storage": "private-blob",
        "metrics": validation,
        "steps": _steps(),
        "can_publish": False,
        "message": "Base recebida, armazenada e validada. A publicação permanece bloqueada até a conclusão das próximas etapas da pipeline.",
    }
    _write_json(f"{RUN_PREFIX}{run_id}.json", run, overwrite=False)

    history = [item for item in _load_index() if item.get("id") != run_id]
    summary = {
        "id": run["id"],
        "status": run["status"],
        "phase": run["phase"],
        "created_at": run["created_at"],
        "local_created_at": run["local_created_at"],
        "source_name": run["source_name"],
        "canonical_name": run["canonical_name"],
        "sha256": run["sha256"],
        "metrics": run["metrics"],
        "steps": run["steps"],
        "can_publish": False,
        "message": run["message"],
    }
    _save_index([summary, *history])
    return {"ok": True, "duplicate": False, "run": run}


__all__ = [
    "IPMUpdateError",
    "create_ipm_import",
    "get_ipm_import",
    "list_ipm_imports",
    "validate_ipm_xlsx",
]
