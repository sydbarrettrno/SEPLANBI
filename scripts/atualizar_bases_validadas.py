from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import os
import sys
import tempfile
from collections import Counter
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.importar_excel import (
    _apply_atomically,
    _dictionary,
    _ensure_external_xlsx,
    _excel_datetime,
    _protocol_parts,
    _sha256_file,
    _sheet_rows,
)


BASE_DATE = date(2025, 1, 1)
BASE_DATETIME = datetime(2025, 1, 1)
MASTER_SHEET = "BASE_SISTEMA_VALIDADA"
EVENT_SHEET = "MOVIMENTOS"
RECEIVED_SHEET = "01_RECEBIDOS"
OUTPUT_SHEET = "02_SAIDAS"
STOCK_SHEET = "03_ESTOQUE"
PROJECT_SHEET = "10_PROJETOS_PUBLICOS"
CHUNK_SIZE = 12_000

VALID_STATUSES = {
    "Em Análise",
    "Finalização Interna",
    "Aguardando Responsável Externo",
    "Paralisado",
    "Concluído",
    "Encerrado",
}
TERMINAL_STATUSES = {"Concluído", "Encerrado"}
STATUS_ALIASES = {
    "Em Formalização": "Finalização Interna",
    "Aguardando Requerente": "Aguardando Responsável Externo",
    "Aguardando RT": "Aguardando Responsável Externo",
    "Aguardando Responsável Técnico": "Aguardando Responsável Externo",
    "Aguardando Terceiro/Setor": "Aguardando Responsável Externo",
    "Suspenso": "Paralisado",
}
PRIVATE_FIELDS = (
    "ResponsavelInterno",
    "NomeRequerente",
    "ResponsavelTecnico",
    "PessoaResponsavelExterna",
    "TipoPessoaResponsavel",
    "ObservacaoUltimoTramite",
)
PUBLIC_ROW_FIELDS = (
    "ProtocoloID",
    "DataAbertura",
    "UltimoTramiteDataHora",
    "DataEncerramento",
    "DataSaida",
    "TipoSaida",
    "Macroprocesso",
    "Categoria",
    "StatusOperacional",
    "SetorAtual",
)


def _clean(value) -> str:
    return "" if value is None else str(value).strip()


def _protocol_id(value) -> str:
    parts = _protocol_parts(_clean(value))
    if not parts:
        raise RuntimeError(f"Protocolo inválido: {_clean(value)!r}")
    number, year = parts
    if year < 2025:
        raise RuntimeError(f"Protocolo fora do contrato 2025+: {year}-{number}")
    return f"{year}-{number}"


def _date_value(value, field: str, protocol_id: str, allow_empty: bool = False) -> datetime | None:
    parsed = _excel_datetime(value)
    if parsed is None and not (allow_empty and not _clean(value)):
        raise RuntimeError(f"{field} inválida em {protocol_id}.")
    return parsed


def _date_offset(value: datetime | None) -> int:
    return -1 if value is None else (value.date() - BASE_DATE).days


def _normalize_status(value: str) -> tuple[str, bool]:
    original = _clean(value)
    normalized = STATUS_ALIASES.get(original, original)
    if normalized not in VALID_STATUSES:
        raise RuntimeError(f"Status fora da camada homologada: {original!r}")
    return normalized, normalized != original


def _rows(path: Path, sheet: str) -> list[dict[str, str]]:
    return [
        row
        for row in _sheet_rows(path, sheet)
        if any(_clean(value) for value in row.values())
    ]


def _fingerprint(record: dict) -> str:
    values = (
        record["protocol_id"],
        record["opened"].date().isoformat(),
        record["moved"].date().isoformat(),
        "" if record["formal_closed"] is None else record["formal_closed"].date().isoformat(),
        "" if record["exit_at"] is None else record["exit_at"].date().isoformat(),
        record["exit_type"],
        record["macro"],
        record["category"],
        record["status"],
        record["sector"],
    )
    return hashlib.sha256("\x1f".join(values).encode("utf-8")).hexdigest()[:20]


def _load_master(path: Path) -> tuple[dict[str, dict], dict]:
    records: dict[str, dict] = {}
    normalized_aliases = Counter()
    for row_number, row in enumerate(_rows(path, MASTER_SHEET), start=2):
        protocol_id = _protocol_id(row.get("ProtocoloID"))
        if protocol_id in records:
            raise RuntimeError(f"Protocolo duplicado na V06: {protocol_id}")
        opened = _date_value(row.get("DataAbertura"), "DataAbertura", protocol_id)
        moved = _date_value(row.get("UltimoTramiteDataHora"), "UltimoTramiteDataHora", protocol_id)
        formal_closed = _date_value(
            row.get("DataEncerramento"), "DataEncerramento", protocol_id, allow_empty=True
        )
        if moved < opened:
            raise RuntimeError(f"Último trâmite anterior à abertura em {protocol_id}.")
        if formal_closed is not None and formal_closed < opened:
            raise RuntimeError(f"Encerramento formal anterior à abertura em {protocol_id}.")
        status, changed = _normalize_status(row.get("StatusOperacional"))
        if changed:
            normalized_aliases[f"{_clean(row.get('StatusOperacional'))} -> {status}"] += 1
        macro = _clean(row.get("Macroprocesso"))
        category = _clean(row.get("Categoria"))
        if not macro or not category:
            raise RuntimeError(f"Semântica incompleta na V06 em {protocol_id}.")
        records[protocol_id] = {
            "protocol_id": protocol_id,
            "number": int(protocol_id.split("-", 1)[1]),
            "year": int(protocol_id[:4]),
            "opened": opened,
            "moved": moved,
            "formal_closed": formal_closed,
            "exit_at": None,
            "exit_type": "",
            "macro": macro,
            "category": category,
            "status": status,
            "sector": "",
        }
    if not records:
        raise RuntimeError("A V06 não contém protocolos 2025+.")
    return records, {"status_aliases": dict(normalized_aliases)}


def _safe_snapshot(row: dict, status_field: str = "Status") -> tuple:
    status, _ = _normalize_status(row.get(status_field))
    protocol_id = _protocol_id(row.get("ProtocoloID"))
    return (
        protocol_id,
        _date_value(row.get("DataAbertura"), "DataAbertura", protocol_id).date().isoformat(),
        _date_value(row.get("UltimoTramite"), "UltimoTramite", protocol_id).date().isoformat(),
        _clean(row.get("Macroprocesso")),
        _clean(row.get("Categoria")),
        status,
    )


def _master_snapshot(record: dict) -> tuple:
    return (
        record["protocol_id"],
        record["opened"].date().isoformat(),
        record["moved"].date().isoformat(),
        record["macro"],
        record["category"],
        record["status"],
    )


def _load_indicators(path: Path, records: dict[str, dict]) -> tuple[list[dict], list[dict], dict]:
    received_rows = _rows(path, RECEIVED_SHEET)
    output_rows = _rows(path, OUTPUT_SHEET)
    stock_rows = _rows(path, STOCK_SHEET)

    received_by_id: dict[str, dict] = {}
    private_by_id: dict[str, dict] = {}
    private_priority_mismatches = 0
    for row in received_rows:
        protocol_id = _protocol_id(row.get("ProtocoloID"))
        if protocol_id in received_by_id:
            raise RuntimeError(f"Protocolo duplicado na aba {RECEIVED_SHEET}: {protocol_id}")
        received_by_id[protocol_id] = row
        if protocol_id not in records or _safe_snapshot(row) != _master_snapshot(records[protocol_id]):
            raise RuntimeError(f"V04 diverge da V06 nos campos canônicos de {protocol_id}.")
        requester = _clean(row.get("NomeRequerente"))
        technical = _clean(row.get("ResponsavelTecnico"))
        external = _clean(row.get("PessoaResponsavelExterna"))
        if external != (technical or requester):
            private_priority_mismatches += 1
        private_by_id[protocol_id] = {
            "ProtocoloID": protocol_id,
            **{field: _clean(row.get(field)) for field in PRIVATE_FIELDS},
        }

    if set(received_by_id) != set(records):
        raise RuntimeError("A aba de recebidos da V04 não contém exatamente o universo da V06.")
    if private_priority_mismatches:
        raise RuntimeError(
            f"PessoaResponsavelExterna diverge da prioridade RT/requerente em {private_priority_mismatches} registros."
        )

    output_ids: set[str] = set()
    output_sources = Counter()
    for row in output_rows:
        protocol_id = _protocol_id(row.get("ProtocoloID"))
        if protocol_id in output_ids:
            raise RuntimeError(f"Protocolo duplicado na aba {OUTPUT_SHEET}: {protocol_id}")
        if protocol_id not in records:
            raise RuntimeError(f"Saída ausente da V06: {protocol_id}")
        output_ids.add(protocol_id)
        exit_at = _date_value(row.get("DataSaida"), "DataSaida", protocol_id)
        exit_type, _ = _normalize_status(row.get("TipoSaida"))
        if exit_type not in TERMINAL_STATUSES:
            raise RuntimeError(f"Tipo de saída inválido em {protocol_id}: {exit_type}")
        record = records[protocol_id]
        if record["status"] != exit_type:
            raise RuntimeError(f"Status e tipo de saída divergem em {protocol_id}.")
        if exit_at < record["opened"]:
            raise RuntimeError(f"Saída anterior à abertura em {protocol_id}.")
        record["exit_at"] = exit_at
        record["exit_type"] = exit_type
        output_sources[_clean(row.get("FonteDataSaida")) or "Não informado"] += 1

    stock_ids: set[str] = set()
    for row in stock_rows:
        protocol_id = _protocol_id(row.get("ProtocoloID"))
        if protocol_id in stock_ids:
            raise RuntimeError(f"Protocolo duplicado na aba {STOCK_SHEET}: {protocol_id}")
        if protocol_id not in records or _safe_snapshot(row) != _master_snapshot(records[protocol_id]):
            raise RuntimeError(f"Estoque da V04 diverge da V06 em {protocol_id}.")
        records[protocol_id]["sector"] = _clean(row.get("SetorAtual"))
        private_by_id[protocol_id]["ResponsavelInterno"] = _clean(row.get("ResponsavelInterno"))
        stock_ids.add(protocol_id)

    terminal_ids = {key for key, value in records.items() if value["status"] in TERMINAL_STATUSES}
    nonterminal_ids = set(records) - terminal_ids
    if output_ids != terminal_ids or stock_ids != nonterminal_ids or output_ids & stock_ids:
        raise RuntimeError("Saídas e estoque da V04 não particionam exatamente a V06.")

    projects: list[dict] = []
    project_ids: set[str] = set()
    for row in _rows(path, PROJECT_SHEET):
        if _clean(row.get("Contabilizar no dashboard")).casefold() != "sim":
            continue
        project_id = _clean(row.get("ID"))
        if not project_id or project_id in project_ids:
            raise RuntimeError("ID vazio ou duplicado em Projetos Públicos.")
        reference = _date_value(row.get("Data de referência"), "Data de referência", project_id)
        phase = _clean(row.get("Fase atual"))
        status = _clean(row.get("Status atual"))
        if not phase or not status:
            raise RuntimeError(f"Projeto público incompleto: {project_id}")
        project_ids.add(project_id)
        projects.append({"id": project_id, "phase": phase, "status": status, "reference": reference})
    if not projects or {item["reference"].date().isoformat() for item in projects} != {"2026-08-27"}:
        raise RuntimeError("Projetos Públicos não possuem referência única em 27/08/2026.")

    for record in records.values():
        record["source_fingerprint"] = _fingerprint(record)

    return list(private_by_id.values()), projects, {
        "received_universe": len(received_by_id),
        "outputs": len(output_ids),
        "stock": len(stock_ids),
        "output_sources": dict(output_sources),
        "private_priority_mismatches": private_priority_mismatches,
        "public_projects": len(projects),
    }


def _load_events(path: Path, records: dict[str, dict]) -> tuple[list[dict], dict]:
    events = []
    aliases = Counter()
    seen = set()
    for row in _rows(path, EVENT_SHEET):
        protocol_id = _protocol_id(row.get("ProtocoloID"))
        if protocol_id not in records:
            raise RuntimeError(f"Evento referencia protocolo ausente: {protocol_id}")
        event_at = _date_value(row.get("DataEvento"), "DataEvento", protocol_id)
        event_type = _clean(row.get("TipoEvento"))
        status, changed = _normalize_status(row.get("StatusAposEvento"))
        if changed:
            aliases[f"{_clean(row.get('StatusAposEvento'))} -> {status}"] += 1
        if not event_type:
            raise RuntimeError(f"Tipo de evento vazio em {protocol_id}.")
        key = (protocol_id, event_at.isoformat(), event_type, status)
        if key in seen:
            raise RuntimeError(f"Evento duplicado em {protocol_id}.")
        seen.add(key)
        events.append({"protocol_id": protocol_id, "event_at": event_at, "event_type": event_type, "status": status})
    return events, {"event_status_aliases": dict(aliases), "events": len(events)}


def _encode(records: list[dict], events: list[dict], projects: list[dict]):
    records = sorted(records, key=lambda item: (item["year"], item["number"]))
    macros, macro_index = _dictionary([item["macro"] for item in records])
    categories, category_index = _dictionary([item["category"] for item in records])
    statuses, status_index = _dictionary(
        [item["status"] for item in records] + [item["status"] for item in events]
    )
    exit_types, exit_type_index = _dictionary([item["exit_type"] for item in records])
    sectors, sector_index = _dictionary([item["sector"] for item in records])
    event_types, event_type_index = _dictionary([item["event_type"] for item in events] or ["NAO_DETERMINADO"])
    project_phases, project_phase_index = _dictionary([item["phase"] for item in projects])
    project_statuses, project_status_index = _dictionary([item["status"] for item in projects])
    protocol_index = {item["protocol_id"]: index for index, item in enumerate(records)}
    events = sorted(events, key=lambda item: (item["event_at"], item["protocol_id"], item["event_type"]))
    projects = sorted(projects, key=lambda item: item["id"])

    payload = {
        "v": 9,
        "d": {
            "Macroprocesso": macros,
            "Categoria": categories,
            "StatusOperacional": statuses,
            "TipoSaida": exit_types,
            "SetorAtual": sectors,
            "TipoEvento": event_types,
            "ProjetoFase": project_phases,
            "ProjetoStatus": project_statuses,
        },
        "c": {
            "n": [item["number"] for item in records],
            "y": [item["year"] - 2025 for item in records],
            "o": [_date_offset(item["opened"]) for item in records],
            "m": [_date_offset(item["moved"]) for item in records],
            "c": [_date_offset(item["formal_closed"]) for item in records],
            "z": [_date_offset(item["exit_at"]) for item in records],
            "x": [macro_index[item["macro"]] for item in records],
            "g": [category_index[item["category"]] for item in records],
            "t": [status_index[item["status"]] for item in records],
            "u": [exit_type_index[item["exit_type"]] for item in records],
            "h": [sector_index[item["sector"]] for item in records],
            "f": [item["source_fingerprint"] for item in records],
        },
        "e": {
            "p": [protocol_index[item["protocol_id"]] for item in events],
            "a": [int((item["event_at"] - BASE_DATETIME).total_seconds() // 60) for item in events],
            "k": [event_type_index[item["event_type"]] for item in events],
            "s": [status_index[item["status"]] for item in events],
        },
        "pp": {
            "i": [item["id"] for item in projects],
            "f": [project_phase_index[item["phase"]] for item in projects],
            "s": [project_status_index[item["status"]] for item in projects],
            "r": [_date_offset(item["reference"]) for item in projects],
        },
    }
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    encoded = base64.b64encode(compressed).decode("ascii")
    chunks = [encoded[index : index + CHUNK_SIZE] for index in range(0, len(encoded), CHUNK_SIZE)]
    part_names = [f"part-{index:03d}" for index in range(len(chunks))]
    _validate_payload(payload, len(records), len(events), len(projects))
    return compressed, chunks, part_names


def _validate_payload(payload: dict, rows: int, events: int, projects: int) -> None:
    expected_columns = {"n", "y", "o", "m", "c", "z", "x", "g", "t", "u", "h", "f"}
    if payload.get("v") != 9 or set(payload.get("c", {})) != expected_columns:
        raise RuntimeError("Contrato público compacto v9 atualizado não foi produzido.")
    if any(len(payload["c"][key]) != rows for key in expected_columns):
        raise RuntimeError("Colunas do snapshot possuem comprimentos divergentes.")
    ids = [f"{2025 + year}-{number}" for year, number in zip(payload["c"]["y"], payload["c"]["n"])]
    if len(ids) != len(set(ids)):
        raise RuntimeError("O artefato público contém protocolos duplicados.")
    if set(payload["d"]["StatusOperacional"]) != VALID_STATUSES:
        raise RuntimeError("O artefato público não contém exatamente os seis status autorizados.")
    if any(len(payload["e"][key]) != events for key in ("p", "a", "k", "s")):
        raise RuntimeError("Colunas de eventos possuem comprimentos divergentes.")
    if any(len(payload["pp"][key]) != projects for key in ("i", "f", "s", "r")):
        raise RuntimeError("Colunas de projetos públicos possuem comprimentos divergentes.")
    serialized = json.dumps(payload, ensure_ascii=False)
    forbidden = set(PRIVATE_FIELDS) | {"Requerente", "NomeRT", "UltTramiteOBS"}
    if any(name in serialized for name in forbidden):
        raise RuntimeError("Campo privado detectado no artefato público.")


def _metadata(
    master_path: Path,
    indicator_path: Path,
    records: list[dict],
    events: list[dict],
    projects: list[dict],
    compressed: bytes,
    chunks: list[str],
    part_names: list[str],
    audit: dict,
) -> dict:
    source_cut = max(item["moved"] for item in records).date().isoformat()
    years = Counter(str(item["year"]) for item in records)
    status_counts = Counter(item["status"] for item in records)
    project_reference = sorted({item["reference"].date().isoformat() for item in projects})
    return {
        "schema_version": 9,
        "dataset": "SEPLAN 2025+ — V06/V04 validada, seis status e saídas separadas",
        "source_rows": len(records),
        "years": dict(sorted(years.items())),
        "source_updated_at": source_cut,
        "generated_from": [master_path.name, indicator_path.name],
        "source_hashes": {
            "master_v06_xlsx_sha256": _sha256_file(master_path),
            "indicators_v04_xlsx_sha256": _sha256_file(indicator_path),
        },
        "source_of_truth": {
            "operational": {"type": "xlsx", "file": master_path.name, "sheet": MASTER_SHEET},
            "indicators": {"type": "xlsx", "file": indicator_path.name},
            "semantic": {
                "mode": "validated-source-no-reclassification",
                "workbook_validation_version": "V06",
                "taxonomy_version": "V07",
                "note": "Categoria e macroprocesso foram copiados da camada validada; apenas o alias residual Em Formalização foi normalizado para Finalização Interna conforme a lista autorizada desta rodada.",
            },
        },
        "privacy": {
            "policy": "allowlist",
            "published_fields": list(PUBLIC_ROW_FIELDS),
            "published_event_fields": ["ProtocoloID", "DataEvento", "TipoEvento", "StatusAposEvento"],
            "published_project_fields": ["ID", "FaseAtual", "StatusAtual", "DataReferencia"],
            "excluded_fields": list(PRIVATE_FIELDS),
            "note": "PII e observações livres permanecem no artefato local privado externo ao Git; a API pública não possui rota para essa camada.",
        },
        "default_period": {"from": "2026-01-01", "to": source_cut},
        "default_threshold_days": 30,
        "semantic_memory": {
            "taxonomy_version": "V07",
            "category_count": len({item["category"] for item in records}),
            "macroprocess_count": len({item["macro"] for item in records}),
            "status_count": len(VALID_STATUSES),
            "status_counts": dict(status_counts),
        },
        "movement_history": {
            "event_count": len(events),
            "countable_event_types": ["DILIGENCIA", "TRAMITACAO"],
            "limitation": "Cada extrato registra somente o último trâmite observado; não equivale ao histórico integral.",
        },
        "public_projects": {
            "count": len(projects),
            "reference_dates": project_reference,
            "source_sheet": PROJECT_SHEET,
            "note": "Somente ID, fase, status e data de referência entram no transporte público.",
        },
        "import_audit": audit,
        "artifact": {
            "storage": "gzip+base64-chunks",
            "format": "public-compact-v9-v06-v04-with-sector-events-and-projects",
            "gzip_bytes": len(compressed),
            "gzip_sha256": hashlib.sha256(compressed).hexdigest(),
            "base64_chars": sum(len(chunk) for chunk in chunks),
            "date_encoding": "days since 2025-01-01; -1 = null; events use minutes",
            "directory": "final_chunks",
            "parts": part_names,
            "columns": ["n", "y", "o", "m", "c", "z", "x", "g", "t", "u", "h", "f"],
            "event_columns": ["p", "a", "k", "s"],
            "public_project_columns": ["i", "f", "s", "r"],
            "note": "Único artefato canônico consumido pela API; não contém campos privados.",
        },
    }


def _private_payload(source: Path, rows: list[dict]) -> bytes:
    payload = {
        "v": 2,
        "source": source.name,
        "source_sha256": _sha256_file(source),
        "fields": ["ProtocoloID", *PRIVATE_FIELDS],
        "records": rows,
    }
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return gzip.compress(raw, compresslevel=9, mtime=0)


def _write_private_atomically(path: Path, content: bytes) -> None:
    path = path.expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def build(master_path: Path, indicator_path: Path, repo_root: Path):
    master_path = _ensure_external_xlsx(master_path, repo_root, "Base mestre V06")
    indicator_path = _ensure_external_xlsx(indicator_path, repo_root, "Base de indicadores V04")
    record_map, master_audit = _load_master(master_path)
    private_rows, projects, indicator_audit = _load_indicators(indicator_path, record_map)
    events, event_audit = _load_events(master_path, record_map)
    records = list(record_map.values())
    compressed, chunks, part_names = _encode(records, events, projects)
    status_counts = Counter(item["status"] for item in records)
    audit = {
        "protocols_2025_plus": len(records),
        "unique_protocols": len({item["protocol_id"] for item in records}),
        "duplicates": 0,
        "received_2026_to_cutoff": sum(item["opened"].year == 2026 for item in records),
        "outputs_total": sum(item["status"] in TERMINAL_STATUSES for item in records),
        "outputs_2026_to_cutoff": sum(item["exit_at"] is not None and item["exit_at"].year == 2026 for item in records),
        "stock": sum(item["status"] not in TERMINAL_STATUSES for item in records),
        "status_counts": dict(status_counts),
        "status_gate": "APROVADO_6_STATUS",
        **master_audit,
        **indicator_audit,
        **event_audit,
    }
    metadata = _metadata(
        master_path,
        indicator_path,
        records,
        events,
        projects,
        compressed,
        chunks,
        part_names,
        audit,
    )
    return metadata, chunks, _private_payload(indicator_path, private_rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Confere e aplica localmente as bases validadas V06/V04; não executa Git nem deploy."
    )
    parser.add_argument("master_v06", type=Path)
    parser.add_argument("indicators_v04", type=Path)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--private-output", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    repo_root = args.repo.resolve()
    try:
        metadata, chunks, private_content = build(
            args.master_v06, args.indicators_v04, repo_root
        )
        if args.apply:
            _write_private_atomically(args.private_output, private_content)
            _apply_atomically(repo_root, metadata, chunks)
    except RuntimeError as exc:
        print(json.dumps({
            "ok": False,
            "mode": "BLOQUEADO",
            "reason": str(exc),
            "git": "NÃO EXECUTADO",
            "deploy": "NÃO EXECUTADO",
        }, ensure_ascii=False, indent=2))
        raise SystemExit(2) from None

    print(json.dumps({
        "ok": True,
        "mode": "APLICADO" if args.apply else "CONFERENCIA",
        "source_rows": metadata["source_rows"],
        "source_updated_at": metadata["source_updated_at"],
        "audit": metadata["import_audit"],
        "projects": metadata["public_projects"],
        "artifact": {
            "parts": len(chunks),
            "gzip_bytes": metadata["artifact"]["gzip_bytes"],
            "gzip_sha256": metadata["artifact"]["gzip_sha256"],
        },
        "private_layer": {
            "path": str(args.private_output.expanduser().resolve()),
            "rows": metadata["source_rows"],
            "api_exposed": False,
            "written": bool(args.apply),
        },
        "git": "NÃO EXECUTADO",
        "deploy": "NÃO EXECUTADO",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
