from __future__ import annotations

import argparse
import base64
import csv
import gzip
import hashlib
import json
import os
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
import xml.etree.ElementTree as ET


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from scripts.importar_excel import (  # noqa: E402
    BASE_DATE,
    CHUNK_SIZE,
    _apply_atomically,
    _col_index,
    _ensure_external_xlsx,
    _excel_datetime,
    _protocol_parts,
    _sha256_file,
    _validate_payload,
)


NS_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
IPM_SHEET = "Report"
LEGACY_SHEET = "BASE23-26"
AUDIT_SHEETS = ("AUDITORIA_ATUALIZACAO", "STATUS_COMPLETO")
EVENT_TYPES = {
    "TRAMITACAO",
    "DILIGENCIA",
    "ENCERRAMENTO",
    "REABERTURA",
    "CORRECAO_CADASTRAL",
    "OUTRO",
    "NAO_DETERMINADO",
    "INCLUSAO",
}
COUNTABLE_EVENT_TYPES = {"TRAMITACAO", "DILIGENCIA"}
BASE_DATETIME = datetime(2025, 1, 1)
CURRENT_FINGERPRINT_VERSION = 3

HEADER_ALIASES = {
    "Número/Ano": ("Número/Ano",),
    "Requerente": ("Requerente", "Requerente - Nome Razão"),
    "Categoria": ("Categoria", "Subassunto - Descrição"),
    "DataAbertura": ("DataAbertura", "Abertura - Data"),
    "ObsAbertura": ("ObsAbertura", "Observação Abertura"),
    "UltTramiteOBS": ("UltTramiteOBS", "Último Trâmite - Observação"),
    "UltTramiteData": ("UltTramiteData", "Último Trâmite - Data/Hora"),
    "Situação": ("Situação",),
    "CPF_CNPJ_REQUERENTE": ("CPF_CNPJ_REQUERENTE", "Requerente - CPF/CNPJ"),
    "NomeRT": ("NomeRT", "Responsável - Nome"),
    "CPF_CNPJ_RT": ("CPF_CNPJ_RT", "Responsável - CPF/CNPJ"),
    "DataEncerramento": ("DataEncerramento", "Data Encerramento"),
    "Última Atividade": ("Última Atividade",),
    "CCAtual": ("CCAtual", "Centro de Custo Atual - Descrição"),
    "CCAtualClassificacao": ("Centro de Custo Atual - Classificação",),
    "CCAbertura": ("CCAbertura", "Centro de Custo Abertura - Classificação"),
    "CCAberturaDescricao": ("Centro de Custo Abertura - Descrição",),
    "UsuarioAtual": ("UsuarioAtual", "Usuário Atual - Código"),
    "UsuarioAtualNome": ("Usuário Atual - Nome",),
    "PrazoAtual": ("Prazo Atual",),
    "DetalheSituacaoFluxo": ("Det. Situação - Fluxo",),
}
REQUIRED_CANONICAL_HEADERS = {
    "Número/Ano",
    "Categoria",
    "DataAbertura",
    "UltTramiteData",
    "Situação",
    "DataEncerramento",
    "CCAtual",
}
AUDIT_HEADERS = (
    "Protocolo",
    "Tipo Alteração",
    "Categoria Histórica V07",
    "Status Histórico",
    "Categoria Final V07",
    "Status Real",
    "Tipo Evento",
    "Data Último Trâmite",
    "Situação IPM",
    "Detalhe Situação - Fluxo",
    "Subassunto - Descrição",
    "Observação Abertura",
    "Último Trâmite - Observação",
    "Revisado Por",
    "Data Revisão",
    "Justificativa",
)


def _workbook_sheet_targets(path: Path) -> dict[str, str]:
    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
        return {
            sheet.attrib["name"]: relationship_map[sheet.attrib[NS_REL + "id"]]
            for sheet in workbook.find(NS_MAIN + "sheets")
        }


def _sheet_rows(path: Path, sheet_name: str):
    """Lê valores do XLSX sem atualizar conexões nem registrar conteúdo no console."""
    with zipfile.ZipFile(path) as archive:
        targets = _workbook_sheet_targets(path)
        if sheet_name not in targets:
            raise RuntimeError(f"Aba obrigatória ausente: {sheet_name}")
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = [
                "".join(node.text or "" for node in item.iter(NS_MAIN + "t"))
                for item in root
            ]
        target = targets[sheet_name].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        root = ET.fromstring(archive.read(target))
        headers = {}
        for row_number, row in enumerate(root.findall(".//" + NS_MAIN + "sheetData/" + NS_MAIN + "row")):
            values = {}
            for cell in row.findall(NS_MAIN + "c"):
                index = _col_index(cell.attrib.get("r", "A1"))
                cell_type = cell.attrib.get("t")
                node = cell.find(NS_MAIN + "v")
                value = "" if node is None else (node.text or "")
                if cell_type == "s" and value:
                    value = shared_strings[int(value)]
                elif cell_type == "inlineStr":
                    inline = cell.find(NS_MAIN + "is")
                    value = "" if inline is None else "".join(
                        text.text or "" for text in inline.iter(NS_MAIN + "t")
                    )
                values[index] = value
            if row_number == 0:
                headers = {name.strip(): index for index, name in values.items() if name.strip()}
                continue
            yield {name: values.get(index, "") for name, index in headers.items()}


def _canonicalize_row(row: dict[str, str]) -> dict[str, str]:
    canonical = {}
    for target, aliases in HEADER_ALIASES.items():
        matched = [alias for alias in aliases if alias in row]
        canonical[target] = row[matched[0]] if matched else ""
    return canonical


def _select_operational_sheet(path: Path) -> str:
    names = _workbook_sheet_targets(path)
    for candidate in (IPM_SHEET, LEGACY_SHEET):
        if candidate in names:
            return candidate
    raise RuntimeError(
        "Aba operacional não reconhecida. Esperado: Report (IPM atual) ou BASE23-26 (legado)."
    )


def _fingerprint(parts: tuple[str, ...]) -> str:
    return hashlib.sha256("\x1f".join(parts).encode("utf-8")).hexdigest()[:20]


def _legacy_fingerprint(fields: dict[str, str], opened: datetime, moved: datetime, closed: datetime | None) -> str:
    return _fingerprint((
        opened.date().isoformat(),
        moved.date().isoformat(),
        "" if closed is None else closed.date().isoformat(),
        fields["Situação"],
        fields["Categoria"],
        fields["CCAtual"],
    ))


def _current_fingerprint(fields: dict[str, str], opened: datetime, moved: datetime, closed: datetime | None) -> str:
    observation_hash = hashlib.sha256(fields["UltTramiteOBS"].encode("utf-8")).hexdigest()[:12]
    return _fingerprint((
        opened.isoformat(timespec="seconds"),
        moved.isoformat(timespec="seconds"),
        "" if closed is None else closed.isoformat(timespec="seconds"),
        fields["Situação"],
        fields["Categoria"],
        fields["CCAtualClassificacao"],
        fields["CCAtual"],
        observation_hash,
    ))


def _load_raw(path: Path) -> tuple[dict[str, dict], Counter, datetime, str]:
    sheet_name = _select_operational_sheet(path)
    records = {}
    years = Counter()
    max_movement = None
    headers_checked = False
    for row_number, source_row in enumerate(_sheet_rows(path, sheet_name), start=2):
        row = _canonicalize_row(source_row)
        if not headers_checked:
            available = {
                target
                for target, aliases in HEADER_ALIASES.items()
                if any(alias in source_row for alias in aliases)
            }
            missing = sorted(REQUIRED_CANONICAL_HEADERS - available)
            if missing:
                raise RuntimeError("Colunas obrigatórias ausentes: " + ", ".join(missing))
            headers_checked = True
        parts = _protocol_parts(row["Número/Ano"])
        if not parts:
            if any(str(value or "").strip() for value in source_row.values()):
                raise RuntimeError(f"Número/Ano inválido na linha {row_number}.")
            continue
        number, year = parts
        if year < 2025:
            continue
        protocol_id = f"{year}-{number}"
        if protocol_id in records:
            raise RuntimeError("Protocolos duplicados no Excel 2025+; atualização bloqueada.")
        opened = _excel_datetime(row["DataAbertura"])
        moved = _excel_datetime(row["UltTramiteData"])
        closed = _excel_datetime(row["DataEncerramento"])
        if opened is None:
            raise RuntimeError(f"Data de abertura inválida em {protocol_id} (linha {row_number}).")
        if moved is None or moved < opened:
            raise RuntimeError(f"Último trâmite inválido em {protocol_id} (linha {row_number}).")
        if closed is not None and closed < opened:
            raise RuntimeError(f"Encerramento anterior à abertura em {protocol_id}.")
        fields = {key: str(value or "").strip() for key, value in row.items()}
        max_movement = moved if max_movement is None or moved > max_movement else max_movement
        records[protocol_id] = {
            "protocol_id": protocol_id,
            "number": number,
            "year": year,
            "opened": (opened.date() - BASE_DATE).days,
            "moved": (moved.date() - BASE_DATE).days,
            "moved_at": moved,
            "closed": -1 if closed is None else (closed.date() - BASE_DATE).days,
            "opened_datetime": opened,
            "closed_datetime": closed,
            "legacy_fingerprint": _legacy_fingerprint(fields, opened, moved, closed),
            "source_fingerprint": _current_fingerprint(fields, opened, moved, closed),
            "source_fields": fields,
        }
        years[str(year)] += 1
    if not records or max_movement is None:
        raise RuntimeError("Nenhum protocolo 2025+ encontrado no Excel.")
    return records, years, max_movement, sheet_name


def _load_memory(repo_root: Path) -> tuple[dict[str, dict], dict]:
    from backend.final_entry import load_rows
    from backend import core

    rows = load_rows()
    metadata = core.metadata()
    memory = {
        row["ProtocoloID"]: {
            "category": str(row.get("Categoria", "")).strip(),
            "macro": str(row.get("Macroprocesso", "")).strip(),
            "status": str(row.get("StatusOperacional", "")).strip(),
            "opened": (date.fromisoformat(row["DataAbertura"]) - BASE_DATE).days,
            "moved": (date.fromisoformat(row["UltimoTramiteDataHora"]) - BASE_DATE).days,
            "closed": -1 if not row.get("DataEncerramento") else (
                date.fromisoformat(row["DataEncerramento"]) - BASE_DATE
            ).days,
            "source_fingerprint": str(row.get("SourceFingerprint", "")).strip(),
        }
        for row in rows
    }
    return memory, metadata


def _load_payload(repo_root: Path, metadata: dict) -> dict:
    artifact = metadata["artifact"]
    directory = repo_root / "data" / artifact["directory"]
    encoded = "".join((directory / part).read_text(encoding="ascii") for part in artifact["parts"])
    compressed = base64.b64decode(encoded, validate=True)
    if hashlib.sha256(compressed).hexdigest() != artifact["gzip_sha256"]:
        raise RuntimeError("Memória de movimentos bloqueada: checksum do artefato atual diverge.")
    return json.loads(gzip.decompress(compressed).decode("utf-8"))


def _load_previous_events(repo_root: Path, metadata: dict) -> list[dict]:
    payload = _load_payload(repo_root, metadata)
    event_columns = payload.get("e")
    if not event_columns:
        return []
    required = ("p", "a", "k", "s")
    count = len(event_columns.get("p", []))
    if any(len(event_columns.get(key, [])) != count for key in required):
        raise RuntimeError("Histórico de movimentos atual possui vetores divergentes.")
    dictionaries = payload.get("d", {})
    columns = payload["c"]
    types = dictionaries.get("TipoEvento", [])
    statuses = dictionaries.get("StatusOperacional", [])
    events = []
    for index in range(count):
        row_index = int(event_columns["p"][index])
        protocol_id = f"{2025 + int(columns['y'][row_index])}-{int(columns['n'][row_index])}"
        events.append({
            "protocol_id": protocol_id,
            "event_at": BASE_DATETIME + timedelta(minutes=int(event_columns["a"][index])),
            "event_type": types[int(event_columns["k"][index])],
            "status": statuses[int(event_columns["s"][index])],
        })
    return events


def _preserve_historical_closures(raw_records: dict[str, dict], memory: dict[str, dict]) -> int:
    preserved = 0
    for protocol_id in set(raw_records) & set(memory):
        raw = raw_records[protocol_id]
        old = memory[protocol_id]
        if raw["closed"] >= 0 or old["closed"] < 0:
            continue
        preserved += 1
        raw["closed"] = old["closed"]
        raw["closed_datetime"] = BASE_DATETIME + timedelta(days=old["closed"])
        fields = raw["source_fields"]
        raw["legacy_fingerprint"] = _legacy_fingerprint(
            fields, raw["opened_datetime"], raw["moved_at"], raw["closed_datetime"]
        )
        raw["source_fingerprint"] = _current_fingerprint(
            fields, raw["opened_datetime"], raw["moved_at"], raw["closed_datetime"]
        )
    return preserved


def _changed_ids(raw_records: dict[str, dict], memory: dict[str, dict], fingerprint_version: int) -> set[str]:
    key = "source_fingerprint" if fingerprint_version >= 2 else "legacy_fingerprint"
    return {
        protocol_id
        for protocol_id in set(raw_records) & set(memory)
        if raw_records[protocol_id][key] != memory[protocol_id]["source_fingerprint"]
    }


def _prepare_fingerprint_memory(
    memory: dict[str, dict],
    metadata: dict,
    repo_root: Path,
    previous_raw_path: Path | None,
) -> tuple[int, Path | None]:
    """Migra a memória V2 para V3 usando a fonte privada anterior comprovada."""
    version = int(
        metadata.get("source_of_truth", {}).get("operational", {}).get("fingerprint_version", 1)
    )
    if version >= CURRENT_FINGERPRINT_VERSION:
        return version, None
    if previous_raw_path is None:
        raise RuntimeError(
            "A memória usa impressão digital anterior. Informe --previous-excel com a fonte privada "
            "que gerou o dataset vigente para migrar a comparação sem falsos movimentos."
        )
    previous_raw_path = _ensure_external_xlsx(
        previous_raw_path, repo_root, "Relatório IPM anterior"
    )
    expected_hash = str(metadata.get("source_hashes", {}).get("raw_xlsx_sha256", "")).lower()
    actual_hash = _sha256_file(previous_raw_path).lower()
    if not expected_hash or actual_hash != expected_hash:
        raise RuntimeError(
            "Relatório IPM anterior não corresponde ao hash da fonte do dataset vigente; "
            "migração da impressão digital bloqueada."
        )
    previous_records, _, _, _ = _load_raw(previous_raw_path)
    _preserve_historical_closures(previous_records, memory)
    missing = set(memory) - set(previous_records)
    if missing:
        raise RuntimeError(
            "Relatório IPM anterior não contém todos os protocolos da memória vigente; "
            "migração da impressão digital bloqueada."
        )
    for protocol_id, semantic in memory.items():
        semantic["source_fingerprint"] = previous_records[protocol_id]["source_fingerprint"]
    return CURRENT_FINGERPRINT_VERSION, previous_raw_path


def _audit_rows_from_csv(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def _load_semantic_audit(path: Path | None) -> dict[str, dict]:
    if path is None:
        return {}
    if not path.is_file():
        raise RuntimeError(f"Auditoria semântica não encontrada: {path}")
    if path.suffix.lower() == ".csv":
        rows = _audit_rows_from_csv(path)
    elif path.suffix.lower() in {".xlsx", ".xlsm"}:
        sheets = _workbook_sheet_targets(path)
        sheet_name = next((name for name in AUDIT_SHEETS if name in sheets), None)
        if sheet_name is None:
            raise RuntimeError("Aba de auditoria ausente: AUDITORIA_ATUALIZACAO ou STATUS_COMPLETO.")
        rows = _sheet_rows(path, sheet_name)
    else:
        raise RuntimeError("Auditoria semântica deve ser CSV, XLSX ou XLSM.")
    output = {}
    for row_number, row in enumerate(rows, start=2):
        parts = _protocol_parts(row.get("Protocolo", ""))
        if not parts:
            continue
        number, year = parts
        protocol_id = f"{year}-{number}"
        if protocol_id in output:
            raise RuntimeError("Protocolo duplicado na auditoria semântica; atualização bloqueada.")
        output[protocol_id] = {
            "category": str(row.get("Categoria Final V07", "") or "").strip(),
            "status": str(row.get("Status Real", "") or "").strip(),
            "event_type": str(row.get("Tipo Evento", "") or "").strip().upper(),
            "row_number": row_number,
        }
    return output


def _prepare_audit_rows(
    raw_records: dict[str, dict], memory: dict[str, dict], changed_ids: set[str]
) -> list[dict[str, str]]:
    rows = []
    new_ids = set(raw_records) - set(memory)
    target_ids = sorted(new_ids | changed_ids, key=lambda item: (int(item[:4]), int(item.split("-", 1)[1])))
    for protocol_id in target_ids:
        raw = raw_records[protocol_id]
        old = memory.get(protocol_id, {})
        source = raw["source_fields"]
        rows.append({
            "Protocolo": f"{raw['number']}/{raw['year']}",
            "Tipo Alteração": "NOVO_PROTOCOLO" if protocol_id in new_ids else "MOVIMENTACAO_OU_ALTERACAO",
            "Categoria Histórica V07": old.get("category", ""),
            "Status Histórico": old.get("status", ""),
            "Categoria Final V07": old.get("category", ""),
            "Status Real": "",
            "Tipo Evento": "INCLUSAO" if protocol_id in new_ids else "",
            "Data Último Trâmite": raw["moved_at"].isoformat(sep=" ", timespec="seconds"),
            "Situação IPM": source["Situação"],
            "Detalhe Situação - Fluxo": source["DetalheSituacaoFluxo"],
            "Subassunto - Descrição": source["Categoria"],
            "Observação Abertura": source["ObsAbertura"],
            "Último Trâmite - Observação": source["UltTramiteOBS"],
            "Revisado Por": "",
            "Data Revisão": "",
            "Justificativa": "",
        })
    return rows


def prepare_audit(
    raw_path: Path,
    repo_root: Path,
    output_path: Path,
    previous_raw_path: Path | None = None,
) -> dict:
    raw_path = _ensure_external_xlsx(raw_path, repo_root, "Relatório IPM")
    output_path = output_path.expanduser().resolve()
    try:
        common = os.path.commonpath([os.path.normcase(str(output_path)), os.path.normcase(str(repo_root))])
    except ValueError:
        common = ""
    if common == os.path.normcase(str(repo_root)):
        raise RuntimeError("A auditoria contém contexto privado e deve ser gravada fora do repositório.")
    if output_path.suffix.lower() != ".csv":
        raise RuntimeError("O arquivo de auditoria preparado deve usar extensão .csv.")
    raw_records, years, max_movement, source_sheet = _load_raw(raw_path)
    memory, metadata = _load_memory(repo_root)
    preserved_closures = _preserve_historical_closures(raw_records, memory)
    fingerprint_version, migration_source = _prepare_fingerprint_memory(
        memory, metadata, repo_root, previous_raw_path
    )
    changed = _changed_ids(raw_records, memory, fingerprint_version)
    rows = _prepare_audit_rows(raw_records, memory, changed)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=AUDIT_HEADERS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    return {
        "ok": True,
        "mode": "AUDITORIA_PREPARADA",
        "output": str(output_path),
        "source_sheet": source_sheet,
        "source_rows_2025_plus": len(raw_records),
        "years": dict(sorted(years.items())),
        "source_updated_at": max_movement.isoformat(timespec="seconds"),
        "historical_closures_preserved": preserved_closures,
        "fingerprint_version": fingerprint_version,
        "fingerprint_migration_source": "VALIDADA" if migration_source else "NAO_APLICAVEL",
        "new_protocols": len(set(raw_records) - set(memory)),
        "changed_existing": len(changed),
        "audit_rows": len(rows),
        "git": "NÃO EXECUTADO",
        "deploy": "NÃO EXECUTADO",
    }


def _event_key(event: dict) -> tuple[str, str, str, str]:
    event_at = event["event_at"].replace(second=0, microsecond=0)
    return (
        event["protocol_id"],
        event_at.isoformat(timespec="minutes"),
        event["event_type"],
        event["status"],
    )


def _reconcile(
    raw_records: dict[str, dict],
    memory: dict[str, dict],
    audit: dict[str, dict],
    previous_events: list[dict],
    fingerprint_version: int,
):
    raw_ids = set(raw_records)
    memory_ids = set(memory)
    new_ids = raw_ids - memory_ids
    removed_ids = memory_ids - raw_ids
    changed_ids = _changed_ids(raw_records, memory, fingerprint_version)
    category_conflicts = {
        protocol_id
        for protocol_id in (raw_ids & memory_ids & set(audit))
        if audit[protocol_id]["category"]
        and audit[protocol_id]["category"] != memory[protocol_id]["category"]
    }
    unchanged_status_conflicts = {
        protocol_id
        for protocol_id in (raw_ids & memory_ids & set(audit)) - changed_ids
        if audit[protocol_id]["status"]
        and audit[protocol_id]["status"] != memory[protocol_id]["status"]
    }
    unaudited_new = new_ids - set(audit)
    unaudited_changed = changed_ids - set(audit)
    incomplete_new = {
        protocol_id for protocol_id in new_ids & set(audit)
        if not audit[protocol_id]["category"] or not audit[protocol_id]["status"]
    }
    incomplete_changed = {
        protocol_id for protocol_id in changed_ids & set(audit)
        if not audit[protocol_id]["status"] or not audit[protocol_id]["event_type"]
    }
    invalid_event_types = {
        protocol_id for protocol_id in (new_ids | changed_ids) & set(audit)
        if audit[protocol_id]["event_type"] and audit[protocol_id]["event_type"] not in EVENT_TYPES
    }
    category_macros = defaultdict(set)
    for item in memory.values():
        category_macros[item["category"]].add(item["macro"])
    unresolved_macro = {
        protocol_id
        for protocol_id in new_ids & set(audit)
        if audit[protocol_id]["category"] and len(category_macros[audit[protocol_id]["category"]]) != 1
    }
    blockers = {
        "protocols_removed_from_source": len(removed_ids),
        "new_without_semantic_audit": len(unaudited_new),
        "changed_without_semantic_audit": len(unaudited_changed),
        "incomplete_new_audit": len(incomplete_new),
        "incomplete_changed_audit": len(incomplete_changed),
        "invalid_event_types": len(invalid_event_types),
        "immutable_category_conflicts": len(category_conflicts),
        "status_conflicts_without_source_change": len(unchanged_status_conflicts),
        "new_with_unresolved_macroprocess": len(unresolved_macro),
    }
    if any(blockers.values()):
        raise RuntimeError(
            "Atualização bloqueada pelos gates semânticos: "
            + json.dumps(blockers, ensure_ascii=False, sort_keys=True)
        )

    reconciled = []
    new_events = list(previous_events)
    known_event_keys = {_event_key(event) for event in new_events}
    for protocol_id in sorted(raw_ids, key=lambda item: (int(item[:4]), int(item.split("-", 1)[1]))):
        raw = dict(raw_records[protocol_id])
        raw.pop("source_fields", None)
        raw.pop("opened_datetime", None)
        raw.pop("closed_datetime", None)
        raw.pop("legacy_fingerprint", None)
        if protocol_id in memory:
            semantic = dict(memory[protocol_id])
            if protocol_id in changed_ids:
                semantic["status"] = audit[protocol_id]["status"]
                event = {
                    "protocol_id": protocol_id,
                    "event_at": raw["moved_at"],
                    "event_type": audit[protocol_id]["event_type"],
                    "status": semantic["status"],
                }
                if _event_key(event) not in known_event_keys:
                    new_events.append(event)
                    known_event_keys.add(_event_key(event))
        else:
            semantic_audit = audit[protocol_id]
            macro = next(iter(category_macros[semantic_audit["category"]]))
            semantic = {
                "category": semantic_audit["category"],
                "macro": macro,
                "status": semantic_audit["status"],
            }
            event = {
                "protocol_id": protocol_id,
                "event_at": raw["moved_at"],
                "event_type": "INCLUSAO",
                "status": semantic["status"],
            }
            if _event_key(event) not in known_event_keys:
                new_events.append(event)
                known_event_keys.add(_event_key(event))
        raw.pop("moved_at", None)
        raw.update(category=semantic["category"], macro=semantic["macro"], status=semantic["status"])
        reconciled.append(raw)

    summary = {
        "protocols_2025_plus": len(reconciled),
        "classification_memory_hits": len(raw_ids & memory_ids),
        "unchanged_existing": len((raw_ids & memory_ids) - changed_ids),
        "changed_existing_audited": len(changed_ids),
        "new_audited": len(new_ids),
        "removed": 0,
        "events_total": len(new_events),
        "events_added": len(new_events) - len(previous_events),
        "countable_events_total": sum(
            1 for event in new_events if event["event_type"] in COUNTABLE_EVENT_TYPES
        ),
        "semantic_gate": "APROVADO",
    }
    return reconciled, new_events, summary


def _dictionary(values: list[str]) -> tuple[list[str], dict[str, int]]:
    unique = sorted(set(values))
    return unique, {value: index for index, value in enumerate(unique)}


def _encode(records: list[dict], events: list[dict]) -> tuple[bytes, list[str], list[str]]:
    macros, macro_index = _dictionary([record["macro"] for record in records])
    categories, category_index = _dictionary([record["category"] for record in records])
    statuses, status_index = _dictionary(
        [record["status"] for record in records] + [event["status"] for event in events]
    )
    event_types, event_type_index = _dictionary(
        [event["event_type"] for event in events] or ["NAO_DETERMINADO"]
    )
    protocol_index = {record["protocol_id"]: index for index, record in enumerate(records)}
    sorted_events = sorted(
        events,
        key=lambda item: (
            item["event_at"].replace(second=0, microsecond=0),
            item["protocol_id"],
            item["event_type"],
            item["status"],
        ),
    )
    payload = {
        "v": 8,
        "d": {
            "Macroprocesso": macros,
            "Categoria": categories,
            "StatusOperacional": statuses,
            "TipoEvento": event_types,
        },
        "c": {
            "n": [record["number"] for record in records],
            "y": [record["year"] - 2025 for record in records],
            "o": [record["opened"] for record in records],
            "m": [record["moved"] for record in records],
            "c": [record["closed"] for record in records],
            "x": [macro_index[record["macro"]] for record in records],
            "g": [category_index[record["category"]] for record in records],
            "t": [status_index[record["status"]] for record in records],
            "f": [record["source_fingerprint"] for record in records],
        },
        "e": {
            "p": [protocol_index[event["protocol_id"]] for event in sorted_events],
            "a": [int((event["event_at"] - BASE_DATETIME).total_seconds() // 60) for event in sorted_events],
            "k": [event_type_index[event["event_type"]] for event in sorted_events],
            "s": [status_index[event["status"]] for event in sorted_events],
        },
    }
    raw_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(raw_json, compresslevel=9, mtime=0)
    _validate_payload(compressed, len(records))
    event_columns = payload["e"]
    if any(len(event_columns[key]) != len(sorted_events) for key in ("p", "a", "k", "s")):
        raise RuntimeError("Vetores do histórico de movimentos possuem comprimentos divergentes.")
    if any(not 0 <= index < len(records) for index in event_columns["p"]):
        raise RuntimeError("Histórico de movimentos referencia protocolo inexistente.")
    encoded = base64.b64encode(compressed).decode("ascii")
    chunks = [encoded[index:index + CHUNK_SIZE] for index in range(0, len(encoded), CHUNK_SIZE)]
    part_names = [f"part-{index:03d}" for index in range(len(chunks))]
    return compressed, chunks, part_names


def _metadata(
    raw_path: Path,
    semantic_path: Path,
    source_sheet: str,
    records: list[dict],
    events: list[dict],
    years: Counter,
    max_movement: datetime,
    compressed: bytes,
    part_names: list[str],
    encoded_length: int,
    import_audit: dict,
    preserved_closures: int,
    previous_metadata: dict,
    previous_raw_path: Path | None,
) -> dict:
    prior_coverage = previous_metadata.get("movement_history", {}).get("coverage_start")
    coverage_start = prior_coverage or previous_metadata.get("source_updated_at")
    return {
        "schema_version": 8,
        "dataset": "SEPLAN 2025+ — base operacional minimizada, memória V07 e movimentos registrados",
        "source_rows": len(records),
        "years": dict(sorted(years.items())),
        "source_updated_at": max_movement.date().isoformat(),
        "generated_from": [raw_path.name, semantic_path.name],
        "source_hashes": {
            "raw_xlsx_sha256": _sha256_file(raw_path),
            "semantic_audit_sha256": _sha256_file(semantic_path),
            **(
                {"previous_raw_xlsx_sha256": _sha256_file(previous_raw_path)}
                if previous_raw_path is not None else {}
            ),
        },
        "source_of_truth": {
            "operational": {
                "type": "xlsx",
                "sheet": source_sheet,
                "fingerprint_version": CURRENT_FINGERPRINT_VERSION,
                "volatile_fields_excluded": ["Última Atividade"],
            },
            "semantic": {
                "mode": "immutable-by-protocol",
                "version": "V07",
                "sheet": next((name for name in AUDIT_SHEETS if semantic_path.suffix.lower() != ".csv" and name in _workbook_sheet_targets(semantic_path)), "CSV"),
                "note": "Categoria existente é preservada; protocolo novo e alteração operacional exigem auditoria semântica registrada; homologação administrativa permanece separada.",
            },
        },
        "privacy": {
            "policy": "allowlist",
            "published_fields": [
                "ProtocoloID", "DataAbertura", "UltimoTramiteDataHora", "DataEncerramento",
                "Macroprocesso", "Categoria", "StatusOperacional",
            ],
            "published_event_fields": ["ProtocoloID", "DataEvento", "TipoEvento", "StatusAposEvento"],
            "excluded_fields": [
                "Requerente", "CPF_CNPJ_REQUERENTE", "NomeRT", "CPF_CNPJ_RT",
                "ObsAbertura", "UltTramiteOBS", "UsuarioAtual", "CCAbertura",
            ],
            "note": "Excel bruto e auditoria ficam fora do Git; observações livres e dados pessoais não entram no artefato.",
        },
        "default_period": {"from": f"{max_movement.year}-01-01", "to": max_movement.date().isoformat()},
        "default_threshold_days": int(previous_metadata.get("default_threshold_days", 30)),
        "semantic_memory": {
            "taxonomy_version": "V07",
            "category_count": len({record["category"] for record in records}),
            "macroprocess_count": len({record["macro"] for record in records}),
            "status_count": len({record["status"] for record in records}),
        },
        "movement_history": {
            "coverage_start": coverage_start,
            "event_count": len(events),
            "countable_event_types": sorted(COUNTABLE_EVENT_TYPES),
            "historical_closures_preserved_from_memory": preserved_closures,
            "limitation": "Cada extrato registra somente o último trâmite observado; múltiplos eventos entre duas extrações podem não ser recuperáveis.",
        },
        "import_audit": import_audit,
        "artifact": {
            "storage": "gzip+base64-chunks",
            "format": "public-compact-v8-canonical-with-events-v1",
            "gzip_bytes": len(compressed),
            "gzip_sha256": hashlib.sha256(compressed).hexdigest(),
            "base64_chars": encoded_length,
            "date_encoding": "snapshot: days since 2025-01-01; event: minutes since 2025-01-01T00:00",
            "directory": "final_chunks",
            "parts": part_names,
            "columns": ["n", "y", "o", "m", "c", "x", "g", "t", "f"],
            "event_columns": ["p", "a", "k", "s"],
            "note": "Único artefato canônico; snapshot e eventos sanitizados compartilham o mesmo transporte.",
        },
    }


def build(
    raw_path: Path,
    repo_root: Path,
    semantic_path: Path,
    previous_raw_path: Path | None = None,
):
    raw_path = _ensure_external_xlsx(raw_path, repo_root, "Relatório IPM")
    semantic_path = semantic_path.expanduser().resolve()
    if semantic_path.suffix.lower() in {".xlsx", ".xlsm"}:
        semantic_path = _ensure_external_xlsx(semantic_path, repo_root, "Auditoria semântica")
    elif semantic_path.suffix.lower() == ".csv":
        if not semantic_path.is_file():
            raise RuntimeError(f"Auditoria semântica não encontrada: {semantic_path}")
        try:
            common = os.path.commonpath([os.path.normcase(str(semantic_path)), os.path.normcase(str(repo_root))])
        except ValueError:
            common = ""
        if common == os.path.normcase(str(repo_root)):
            raise RuntimeError("A auditoria semântica privada deve permanecer fora do repositório.")
    else:
        raise RuntimeError("Auditoria semântica deve ser CSV, XLSX ou XLSM.")
    raw_records, years, max_movement, source_sheet = _load_raw(raw_path)
    memory, previous_metadata = _load_memory(repo_root)
    preserved_closures = _preserve_historical_closures(raw_records, memory)
    fingerprint_version, migration_source = _prepare_fingerprint_memory(
        memory, previous_metadata, repo_root, previous_raw_path
    )
    audit = _load_semantic_audit(semantic_path)
    previous_events = _load_previous_events(repo_root, previous_metadata)
    records, events, import_audit = _reconcile(
        raw_records, memory, audit, previous_events, fingerprint_version
    )
    import_audit["historical_closures_preserved"] = preserved_closures
    import_audit["fingerprint_migration_source"] = (
        "VALIDADA" if migration_source else "NAO_APLICAVEL"
    )
    compressed, chunks, part_names = _encode(records, events)
    metadata = _metadata(
        raw_path,
        semantic_path,
        source_sheet,
        records,
        events,
        years,
        max_movement,
        compressed,
        part_names,
        sum(len(chunk) for chunk in chunks),
        import_audit,
        preserved_closures,
        previous_metadata,
        migration_source,
    )
    return metadata, chunks


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prepara auditoria ou atualiza o artefato sanitizado a partir do relatório IPM, sem executar Git ou deploy."
    )
    parser.add_argument("excel", type=Path, help="Relatorio.xlsx externo exportado pelo IPM.")
    parser.add_argument("--semantic-audit", type=Path, default=None, help="CSV/XLSX preenchido com a auditoria dos protocolos novos ou alterados.")
    parser.add_argument("--prepare-audit", type=Path, default=None, help="Gera CSV privado com os protocolos que exigem revisão humana.")
    parser.add_argument(
        "--previous-excel",
        type=Path,
        default=None,
        help="Fonte privada anterior, exigida somente para migrar versões antigas da impressão digital.",
    )
    parser.add_argument("--repo", type=Path, default=REPO_ROOT, help="Raiz do repositório SEPLANBI.")
    parser.add_argument("--apply", action="store_true", help="Substitui data/final_chunks e metadata.json de forma transacional após todos os gates.")
    args = parser.parse_args()
    repo_root = args.repo.resolve()
    try:
        if args.prepare_audit is not None:
            if args.semantic_audit is not None or args.apply:
                raise RuntimeError("--prepare-audit não pode ser combinado com --semantic-audit ou --apply.")
            result = prepare_audit(
                args.excel, repo_root, args.prepare_audit, args.previous_excel
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return
        if args.semantic_audit is None:
            raise RuntimeError("Informe --prepare-audit para gerar a revisão ou --semantic-audit para concluir a atualização.")
        metadata, chunks = build(
            args.excel, repo_root, args.semantic_audit, args.previous_excel
        )
        if args.apply:
            _apply_atomically(repo_root, metadata, chunks)
        result = {
            "ok": True,
            "mode": "APLICADO" if args.apply else "CONFERENCIA",
            "source_rows": metadata["source_rows"],
            "source_updated_at": metadata["source_updated_at"],
            "years": metadata["years"],
            "semantic_memory": metadata["semantic_memory"],
            "movement_history": metadata["movement_history"],
            "audit": metadata["import_audit"],
            "artifact": {
                "parts": len(chunks),
                "gzip_bytes": metadata["artifact"]["gzip_bytes"],
                "gzip_sha256": metadata["artifact"]["gzip_sha256"],
            },
            "git": "NÃO EXECUTADO",
            "deploy": "NÃO EXECUTADO",
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except RuntimeError as exc:
        print(json.dumps({
            "ok": False,
            "mode": "BLOQUEADO",
            "reason": str(exc),
            "git": "NÃO EXECUTADO",
            "deploy": "NÃO EXECUTADO",
        }, ensure_ascii=False, indent=2))
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
