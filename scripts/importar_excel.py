from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import os
import shutil
import sys
import tempfile
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
import xml.etree.ElementTree as ET


NS_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
BASE_DATE = date(2025, 1, 1)
RAW_SHEET = "BASE23-26"
SEMANTIC_SHEET = "STATUS_COMPLETO"
CHUNK_SIZE = 12_000
PUBLISHED_FIELDS = (
    "ProtocoloID",
    "DataAbertura",
    "UltimoTramiteDataHora",
    "DataEncerramento",
    "Macroprocesso",
    "Categoria",
    "StatusOperacional",
)
EXCLUDED_FIELDS = (
    "Requerente",
    "CPF_CNPJ_REQUERENTE",
    "NomeRT",
    "CPF_CNPJ_RT",
    "ObsAbertura",
    "UltTramiteOBS",
    "UsuarioAtual",
    "CCAbertura",
)
ALLOWED_RAW_HEADERS = {
    "Número/Ano",
    "Requerente",
    "Categoria",
    "DataAbertura",
    "ObsAbertura",
    "UltTramiteOBS",
    "UltTramiteData",
    "Situação",
    "CPF_CNPJ_REQUERENTE",
    "NomeRT",
    "CPF_CNPJ_RT",
    "DataEncerramento",
    "Última Atividade",
    "CCAtual",
    "CCAbertura",
    "UsuarioAtual",
}


def _col_index(ref: str) -> int:
    number = 0
    for character in ref:
        if not character.isalpha():
            break
        number = number * 26 + (ord(character.upper()) - 64)
    return number - 1


def _sheet_rows(path: Path, sheet_name: str):
    """Lê somente valores do XLSX, sem carregar estilos nem expor linhas no log."""
    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
        targets = {}
        for sheet in workbook.find(NS_MAIN + "sheets"):
            targets[sheet.attrib["name"]] = relationship_map[sheet.attrib[NS_REL + "id"]]
        if sheet_name not in targets:
            raise RuntimeError(f"Aba obrigatória ausente: {sheet_name}")

        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root:
                shared_strings.append("".join(node.text or "" for node in item.iter(NS_MAIN + "t")))

        target = targets[sheet_name]
        sheet_path = target.lstrip("/")
        if not sheet_path.startswith("xl/"):
            sheet_path = "xl/" + sheet_path
        root = ET.fromstring(archive.read(sheet_path))
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


def _excel_datetime(value) -> datetime | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime(1899, 12, 30) + timedelta(days=float(text))
    except ValueError:
        pass
    for date_format in (
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(text[:19], date_format)
        except ValueError:
            continue
    return None


def _protocol_parts(value: str) -> tuple[int, int] | None:
    text = str(value or "").strip()
    separator = "/" if "/" in text else "-" if "-" in text else None
    if not separator:
        return None
    left, right = text.rsplit(separator, 1)
    try:
        left_number = int(left.strip())
        right_number = int(right.strip())
    except ValueError:
        return None
    if separator == "/":
        return left_number, right_number
    if 2000 <= left_number <= 2100:
        return right_number, left_number
    return left_number, right_number


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_handle:
        for block in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _ensure_external_xlsx(path: Path, repo_root: Path, label: str) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.is_file():
        raise RuntimeError(f"{label} não encontrado: {resolved}")
    if resolved.suffix.lower() not in {".xlsx", ".xlsm"}:
        raise RuntimeError(f"{label} deve ser um arquivo XLSX/XLSM: {resolved.name}")
    repo_resolved = repo_root.resolve()
    try:
        common = os.path.commonpath(
            [os.path.normcase(str(resolved)), os.path.normcase(str(repo_resolved))]
        )
    except ValueError:
        common = ""
    if common == os.path.normcase(str(repo_resolved)):
        raise RuntimeError(f"{label} deve permanecer fora do repositório: {resolved}")
    return resolved


def _source_fingerprint(row: dict[str, str], opened: datetime, moved: datetime, closed: datetime | None) -> str:
    relevant = (
        opened.date().isoformat(),
        moved.date().isoformat(),
        "" if closed is None else closed.date().isoformat(),
        str(row.get("Situação", "")).strip(),
        str(row.get("Categoria", "")).strip(),
        str(row.get("CCAtual", "")).strip(),
    )
    return hashlib.sha256("\x1f".join(relevant).encode("utf-8")).hexdigest()[:20]


def _load_raw(path: Path) -> tuple[dict[str, dict], Counter, datetime]:
    required = {
        "Número/Ano",
        "DataAbertura",
        "UltTramiteData",
        "Situação",
        "Categoria",
        "DataEncerramento",
        "CCAtual",
    }
    records = {}
    years = Counter()
    max_movement = None
    for row_number, row in enumerate(_sheet_rows(path, RAW_SHEET), start=2):
        if row_number == 2:
            missing = sorted(required.difference(row.keys()))
            if missing:
                raise RuntimeError("Colunas obrigatórias ausentes: " + ", ".join(missing))
            unexpected = sorted(set(row).difference(ALLOWED_RAW_HEADERS))
            if unexpected:
                raise RuntimeError("Colunas não homologadas na origem: " + ", ".join(unexpected))
        parts = _protocol_parts(row.get("Número/Ano", ""))
        if not parts:
            if any(str(value or "").strip() for value in row.values()):
                raise RuntimeError(f"Número/Ano inválido na linha {row_number}.")
            continue
        number, year = parts
        if year < 2025:
            continue
        protocol_id = f"{year}-{number}"
        if protocol_id in records:
            raise RuntimeError("Protocolos duplicados no Excel 2025+; atualização bloqueada.")
        opened = _excel_datetime(row.get("DataAbertura"))
        moved = _excel_datetime(row.get("UltTramiteData"))
        closed = _excel_datetime(row.get("DataEncerramento"))
        if opened is None:
            raise RuntimeError(f"Data de abertura inválida em {protocol_id} (linha {row_number}).")
        if moved is None or moved < opened:
            raise RuntimeError(f"Último trâmite inválido em {protocol_id} (linha {row_number}).")
        if closed is not None and closed < opened:
            raise RuntimeError(f"Encerramento anterior à abertura em {protocol_id}.")
        max_movement = moved if max_movement is None or moved > max_movement else max_movement
        records[protocol_id] = {
            "number": number,
            "year": year,
            "opened": (opened.date() - BASE_DATE).days,
            "moved": (moved.date() - BASE_DATE).days,
            "closed": -1 if closed is None else (closed.date() - BASE_DATE).days,
            "source_fingerprint": _source_fingerprint(row, opened, moved, closed),
        }
        years[str(year)] += 1
    if not records or max_movement is None:
        raise RuntimeError("Nenhum protocolo 2025+ encontrado no Excel.")
    return records, years, max_movement


def _load_current_memory(repo_root: Path) -> dict[str, dict]:
    sys.path.insert(0, str(repo_root))
    try:
        from backend.final_entry import load_rows

        rows = load_rows()
    except Exception as exc:
        raise RuntimeError("A memória semântica canônica atual não pôde ser carregada.") from exc
    return {
        row["ProtocoloID"]: {
            "category": str(row.get("Categoria", "")).strip(),
            "macro": str(row.get("Macroprocesso", "")).strip(),
            "status": str(row.get("StatusOperacional", "")).strip(),
            "opened": (date.fromisoformat(row["DataAbertura"]) - BASE_DATE).days,
            "moved": (date.fromisoformat(row["UltimoTramiteDataHora"]) - BASE_DATE).days,
            "closed": -1
            if not row.get("DataEncerramento")
            else (date.fromisoformat(row["DataEncerramento"]) - BASE_DATE).days,
            "source_fingerprint": str(row.get("SourceFingerprint", "")).strip(),
        }
        for row in rows
    }


def _load_semantic_audit(path: Path | None) -> dict[str, dict]:
    if path is None:
        return {}
    required = {"Protocolo", "Categoria Final V07", "Status Real"}
    output = {}
    for row_number, row in enumerate(_sheet_rows(path, SEMANTIC_SHEET), start=2):
        if row_number == 2:
            missing = sorted(required.difference(row.keys()))
            if missing:
                raise RuntimeError("Colunas semânticas obrigatórias ausentes: " + ", ".join(missing))
        parts = _protocol_parts(row.get("Protocolo", ""))
        if not parts:
            continue
        number, year = parts
        protocol_id = f"{year}-{number}"
        category = str(row.get("Categoria Final V07", "")).strip()
        status = str(row.get("Status Real", "")).strip()
        if not category or not status:
            raise RuntimeError(f"Classificação semântica incompleta em {protocol_id}.")
        if protocol_id in output:
            raise RuntimeError("Protocolo duplicado na memória semântica; atualização bloqueada.")
        output[protocol_id] = {"category": category, "status": status}
    if not output:
        raise RuntimeError("A memória semântica informada não contém protocolos válidos.")
    return output


def _changed_source(raw: dict, memory: dict) -> bool:
    if memory.get("source_fingerprint"):
        return raw["source_fingerprint"] != memory["source_fingerprint"]
    return any(raw[field] != memory[field] for field in ("opened", "moved", "closed"))


def _reconcile(raw_records: dict[str, dict], memory: dict[str, dict], audit: dict[str, dict]):
    raw_ids = set(raw_records)
    memory_ids = set(memory)
    new_ids = raw_ids - memory_ids
    removed_ids = memory_ids - raw_ids
    changed_ids = {
        protocol_id
        for protocol_id in raw_ids & memory_ids
        if _changed_source(raw_records[protocol_id], memory[protocol_id])
    }
    category_conflicts = {
        protocol_id
        for protocol_id in raw_ids & memory_ids & set(audit)
        if audit[protocol_id]["category"] != memory[protocol_id]["category"]
    }
    unchanged_status_conflicts = {
        protocol_id
        for protocol_id in (raw_ids & memory_ids & set(audit)) - changed_ids
        if audit[protocol_id]["status"] != memory[protocol_id]["status"]
    }
    unaudited_new = new_ids - set(audit)
    unaudited_changed = changed_ids - set(audit)

    category_macros = defaultdict(set)
    for item in memory.values():
        category_macros[item["category"]].add(item["macro"])
    unresolved_macro = {
        protocol_id
        for protocol_id in new_ids & set(audit)
        if len(category_macros[audit[protocol_id]["category"]]) != 1
    }

    blockers = {
        "protocols_removed_from_source": len(removed_ids),
        "new_without_semantic_audit": len(unaudited_new),
        "changed_without_semantic_audit": len(unaudited_changed),
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
    for protocol_id in sorted(raw_ids, key=lambda item: (int(item[:4]), int(item.split("-", 1)[1]))):
        raw = dict(raw_records[protocol_id])
        if protocol_id in memory:
            semantic = dict(memory[protocol_id])
            if protocol_id in changed_ids:
                semantic["status"] = audit[protocol_id]["status"]
        else:
            semantic_audit = audit[protocol_id]
            macro = next(iter(category_macros[semantic_audit["category"]]))
            semantic = {
                "category": semantic_audit["category"],
                "macro": macro,
                "status": semantic_audit["status"],
            }
        raw.update(
            category=semantic["category"],
            macro=semantic["macro"],
            status=semantic["status"],
        )
        reconciled.append(raw)

    audit_summary = {
        "protocols_2025_plus": len(reconciled),
        "classification_memory_hits": len(raw_ids & memory_ids),
        "unchanged_existing": len((raw_ids & memory_ids) - changed_ids),
        "changed_existing_audited": len(changed_ids),
        "new_audited": len(new_ids),
        "removed": 0,
        "semantic_gate": "APROVADO",
    }
    return reconciled, audit_summary


def _dictionary(values: list[str]) -> tuple[list[str], dict[str, int]]:
    unique = sorted(set(values))
    return unique, {value: index for index, value in enumerate(unique)}


def _encode(records: list[dict]) -> tuple[bytes, list[str], list[str]]:
    macros, macro_index = _dictionary([record["macro"] for record in records])
    categories, category_index = _dictionary([record["category"] for record in records])
    statuses, status_index = _dictionary([record["status"] for record in records])
    payload = {
        "v": 8,
        "d": {
            "Macroprocesso": macros,
            "Categoria": categories,
            "StatusOperacional": statuses,
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
    }
    raw_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(raw_json, compresslevel=9, mtime=0)
    encoded = base64.b64encode(compressed).decode("ascii")
    chunks = [encoded[index : index + CHUNK_SIZE] for index in range(0, len(encoded), CHUNK_SIZE)]
    part_names = [f"part-{index:03d}" for index in range(len(chunks))]
    _validate_payload(compressed, len(records))
    return compressed, chunks, part_names


def _validate_payload(compressed: bytes, expected_rows: int) -> None:
    try:
        payload = json.loads(gzip.decompress(compressed).decode("utf-8"))
    except Exception as exc:
        raise RuntimeError("Artefato sanitizado inválido.") from exc
    if payload.get("v") != 8:
        raise RuntimeError("Schema canônico v8 não foi produzido.")
    dictionaries = payload.get("d", {})
    columns = payload.get("c", {})
    required = ("n", "y", "o", "m", "c", "x", "g", "t", "f")
    if any(len(columns.get(field, [])) != expected_rows for field in required):
        raise RuntimeError("Colunas do artefato sanitizado possuem comprimentos divergentes.")
    ids = [f"{2025 + int(year)}-{int(number)}" for year, number in zip(columns["y"], columns["n"])]
    if len(ids) != len(set(ids)):
        raise RuntimeError("Artefato sanitizado contém protocolos duplicados.")
    if any(len(str(value)) != 20 for value in columns["f"]):
        raise RuntimeError("Impressão digital operacional inválida.")
    for dictionary_name, column_name in (
        ("Macroprocesso", "x"),
        ("Categoria", "g"),
        ("StatusOperacional", "t"),
    ):
        limit = len(dictionaries.get(dictionary_name, []))
        if not limit or any(not 0 <= int(value) < limit for value in columns[column_name]):
            raise RuntimeError(f"Índice inválido no dicionário {dictionary_name}.")


def _metadata(
    raw_path: Path,
    semantic_path: Path | None,
    records: list[dict],
    years: Counter,
    max_movement: datetime,
    compressed: bytes,
    part_names: list[str],
    encoded_length: int,
    import_audit: dict,
) -> dict:
    return {
        "schema_version": 8,
        "dataset": "SEPLAN 2025+ — base operacional minimizada com memória semântica V07 fixa",
        "source_rows": len(records),
        "years": dict(sorted(years.items())),
        "source_updated_at": max_movement.date().isoformat(),
        "generated_from": [raw_path.name] + ([semantic_path.name] if semantic_path else []),
        "source_hashes": {
            "raw_xlsx_sha256": _sha256_file(raw_path),
            "semantic_xlsx_sha256": _sha256_file(semantic_path) if semantic_path else None,
        },
        "source_of_truth": {
            "operational": {"type": "xlsx", "sheet": RAW_SHEET},
            "semantic": {
                "mode": "immutable-by-protocol",
                "version": "V07",
                "sheet": SEMANTIC_SHEET,
                "note": "Categoria e macroprocesso existentes não são sobrescritos automaticamente; mudanças operacionais exigem auditoria semântica.",
            },
        },
        "privacy": {
            "policy": "allowlist",
            "published_fields": list(PUBLISHED_FIELDS),
            "excluded_fields": list(EXCLUDED_FIELDS),
            "note": "Excel bruto e abas de auditoria permanecem fora do Git; o artefato contém somente campos necessários ao painel e uma impressão digital não reversível.",
        },
        "default_period": {
            "from": f"{max_movement.year}-01-01",
            "to": max_movement.date().isoformat(),
        },
        "default_threshold_days": 30,
        "semantic_memory": {
            "taxonomy_version": "V07",
            "category_count": len({record["category"] for record in records}),
            "macroprocess_count": len({record["macro"] for record in records}),
            "status_count": len({record["status"] for record in records}),
        },
        "import_audit": import_audit,
        "artifact": {
            "storage": "gzip+base64-chunks",
            "format": "public-compact-v8-canonical",
            "gzip_bytes": len(compressed),
            "gzip_sha256": hashlib.sha256(compressed).hexdigest(),
            "base64_chars": encoded_length,
            "date_encoding": "days since 2025-01-01; -1 = null",
            "directory": "final_chunks",
            "parts": part_names,
            "columns": ["n", "y", "o", "m", "c", "x", "g", "t", "f"],
            "note": "Único artefato canônico consumido pela API; classificação V07 já incorporada.",
        },
    }


def build(raw_path: Path, repo_root: Path, semantic_path: Path | None = None):
    raw_path = _ensure_external_xlsx(raw_path, repo_root, "Excel bruto")
    semantic_path = (
        _ensure_external_xlsx(semantic_path, repo_root, "Memória semântica")
        if semantic_path is not None
        else None
    )
    raw_records, years, max_movement = _load_raw(raw_path)
    memory = _load_current_memory(repo_root)
    semantic_audit = _load_semantic_audit(semantic_path)
    records, import_audit = _reconcile(raw_records, memory, semantic_audit)
    compressed, chunks, part_names = _encode(records)
    encoded_length = sum(len(chunk) for chunk in chunks)
    metadata = _metadata(
        raw_path,
        semantic_path,
        records,
        years,
        max_movement,
        compressed,
        part_names,
        encoded_length,
        import_audit,
    )
    return metadata, chunks


def _apply_atomically(repo_root: Path, metadata: dict, chunks: list[str]) -> None:
    data_dir = repo_root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    target_directory = data_dir / metadata["artifact"]["directory"]
    metadata_path = data_dir / "metadata.json"
    stage_directory = Path(tempfile.mkdtemp(prefix=".update-stage-", dir=data_dir))
    backup_parent = Path(tempfile.mkdtemp(prefix=".update-backup-", dir=data_dir))
    backup_directory = backup_parent / target_directory.name
    metadata_temporary = data_dir / f".metadata-{os.getpid()}.tmp"
    previous_metadata = metadata_path.read_bytes() if metadata_path.exists() else None
    moved_previous = False
    try:
        for part_name, content in zip(metadata["artifact"]["parts"], chunks):
            (stage_directory / part_name).write_text(content, encoding="ascii")
        assembled = "".join(
            (stage_directory / part_name).read_text(encoding="ascii")
            for part_name in metadata["artifact"]["parts"]
        )
        compressed = base64.b64decode(assembled, validate=True)
        if hashlib.sha256(compressed).hexdigest() != metadata["artifact"]["gzip_sha256"]:
            raise RuntimeError("Checksum do estágio diverge do manifesto.")
        _validate_payload(compressed, metadata["source_rows"])
        metadata_temporary.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        if target_directory.exists():
            os.replace(target_directory, backup_directory)
            moved_previous = True
        os.replace(stage_directory, target_directory)
        os.replace(metadata_temporary, metadata_path)
    except Exception:
        if target_directory.exists() and moved_previous:
            shutil.rmtree(target_directory)
        if backup_directory.exists():
            os.replace(backup_directory, target_directory)
        if previous_metadata is not None:
            metadata_temporary.write_bytes(previous_metadata)
            os.replace(metadata_temporary, metadata_path)
        raise
    finally:
        if stage_directory.exists():
            shutil.rmtree(stage_directory)
        if metadata_temporary.exists():
            metadata_temporary.unlink()
        if backup_parent.exists():
            shutil.rmtree(backup_parent)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Confere e prepara o artefato canônico sanitizado do Dashboard SEPLAN; não executa Git nem Vercel."
    )
    parser.add_argument("excel", type=Path, help=f"Excel bruto externo com a aba {RAW_SHEET}.")
    parser.add_argument(
        "--semantic-audit",
        type=Path,
        default=None,
        help=f"Excel semântico externo com a aba {SEMANTIC_SHEET}; obrigatório para protocolos novos ou alterados.",
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Raiz do repositório SEPLANBI.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica os artefatos validados ao diretório data/. Sem esta opção, apenas confere.",
    )
    args = parser.parse_args()
    repo_root = args.repo.resolve()
    try:
        metadata, chunks = build(args.excel, repo_root, args.semantic_audit)
    except RuntimeError as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "mode": "BLOQUEADO",
                    "reason": str(exc),
                    "git": "NÃO EXECUTADO",
                    "deploy": "NÃO EXECUTADO",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        raise SystemExit(2) from None
    if args.apply:
        _apply_atomically(repo_root, metadata, chunks)
    result = {
        "ok": True,
        "mode": "APLICADO" if args.apply else "CONFERENCIA",
        "source_rows": metadata["source_rows"],
        "source_updated_at": metadata["source_updated_at"],
        "years": metadata["years"],
        "semantic_memory": metadata["semantic_memory"],
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


if __name__ == "__main__":
    main()
