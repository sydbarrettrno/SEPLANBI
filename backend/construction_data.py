from __future__ import annotations

import base64
import csv
import io
import json
import lzma
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PART_GLOB = "construction_permits_public.xz.b64.part*"
PART_SIZE = 10_000
CA_FILE = DATA_DIR / "construction_ca_public.xz.b64"
PUBLIC_FIELDS = (
    "permit",
    "date",
    "year",
    "type",
    "area",
    "use",
    "construction",
    "coefficient",
)
PUBLIC_USE_LABELS = {
    "Residencial — não especificado": "Residencial unifamiliar",
    "Residencial - não especificado": "Residencial unifamiliar",
    "Residencial não identificado": "Residencial unifamiliar",
}


def _text(value) -> str:
    return str(value or "").strip()


def _integer(value, default: int = 0) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _number(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _optional_number(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _read_encoded_parts(parts: list[Path]) -> str:
    chunks: list[str] = []
    for index, part in enumerate(parts):
        chunk = part.read_text(encoding="ascii").strip()
        if index < len(parts) - 1:
            if len(chunk) < PART_SIZE:
                raise RuntimeError("Parte incompleta da base analítica de alvarás.")
            chunk = chunk[:PART_SIZE]
        chunks.append(chunk)
    return "".join(chunks)


@lru_cache(maxsize=1)
def load_construction_rows() -> tuple[dict, tuple[dict, ...]]:
    parts = sorted(DATA_DIR.glob(PART_GLOB))
    if not parts:
        raise RuntimeError("Base analítica de alvarás não configurada.")
    try:
        encoded = _read_encoded_parts(parts)
        raw = lzma.decompress(base64.b64decode(encoded, validate=True))
        payload = json.loads(raw.decode("utf-8"))
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError("Base analítica de alvarás inválida.") from exc

    if int(payload.get("v") or 0) != 1:
        raise RuntimeError("Versão da base analítica de alvarás não reconhecida.")

    normalized: list[dict] = []
    for item in payload.get("rows", []):
        if not isinstance(item, dict):
            continue
        raw_use = _text(item.get("use"))
        record = {
            "permit": _integer(item.get("permit")),
            "date": _text(item.get("date")),
            "year": _integer(item.get("year")),
            "type": _text(item.get("type")),
            "area": round(_number(item.get("area")), 2),
            "use": PUBLIC_USE_LABELS.get(raw_use, raw_use),
            "construction": _text(item.get("construction")),
        }
        if record["permit"] and record["date"] and record["year"]:
            normalized.append(record)

    if not normalized:
        raise RuntimeError("Base analítica de alvarás vazia.")

    normalized.sort(key=lambda row: (row["date"], row["permit"]), reverse=True)
    meta = {
        "source": _text(payload.get("source")) or "Sistema IPM",
        "extracted_at": _text(payload.get("extractedAt")),
        "total": len(normalized),
    }
    return meta, tuple(normalized)


@lru_cache(maxsize=1)
def load_ca_lookup() -> tuple[dict[tuple[int, int, str, str], float], dict]:
    """Lê o resultado sanitizado do cruzamento Alvarás × Cadastro Imobiliário.

    O arquivo público contém somente a chave administrativa do alvará e o
    coeficiente calculado. Nomes, documentos, endereços e identificadores
    cadastrais usados no cruzamento não são publicados.
    """
    if not CA_FILE.exists():
        return {}, {}
    try:
        encoded = CA_FILE.read_text(encoding="ascii").strip()
        raw = lzma.decompress(base64.b64decode(encoded, validate=True))
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        return {}, {}

    if int(payload.get("v") or 0) != 1:
        return {}, {}

    exact: dict[tuple[int, int, str, str], float] = {}
    for item in payload.get("rows", []):
        if not isinstance(item, dict):
            continue
        permit = _integer(item.get("p"))
        year = _integer(item.get("y"))
        date = _text(item.get("d"))
        permit_type = _text(item.get("t"))
        coefficient = _optional_number(item.get("c"))
        if not permit or not year or not date or not permit_type or coefficient is None:
            continue
        exact[(permit, year, date, permit_type)] = round(coefficient, 3)

    meta = {
        "source": _text(payload.get("source")),
        "formula": _text(payload.get("formula")),
        "processed": _integer(payload.get("processed")),
        "eligible": _integer(payload.get("eligible")),
        "resolved": _integer(payload.get("resolved")),
        "generated_at": _text(payload.get("generatedAt")),
    }
    return exact, meta


def _coefficient_for(row: dict, exact: dict) -> float | None:
    return exact.get((row["permit"], row["year"], row["date"], row["type"]))


def _query_rows(params: dict[str, str]) -> tuple[dict, list[dict], dict]:
    meta, rows_tuple = load_construction_rows()
    rows = list(rows_tuple)

    q = _text(params.get("q")).casefold()
    year = _integer(params.get("year"))
    permit_type = _text(params.get("type"))
    use = _text(params.get("use"))

    filtered: list[dict] = []
    for row in rows:
        if year and row["year"] != year:
            continue
        if permit_type and row["type"] != permit_type:
            continue
        if use and row["use"] != use:
            continue
        if q:
            haystack = " ".join((
                str(row["permit"]),
                f'{row["permit"]}/{row["year"]}',
                row["date"],
                row["type"],
                row["use"],
                row["construction"],
            )).casefold()
            if q not in haystack:
                continue
        filtered.append(row)

    facets = {
        "years": sorted({row["year"] for row in rows}, reverse=True),
        "types": sorted({row["type"] for row in rows if row["type"]}),
        "uses": sorted({row["use"] for row in rows if row["use"]}),
    }
    return meta, filtered, facets


def construction_data_response(params: dict[str, str]) -> dict:
    meta, filtered, facets = _query_rows(params)
    exact_ca, ca_meta = load_ca_lookup()

    enriched: list[dict] = []
    ca_records = 0
    for row in filtered:
        coefficient = _coefficient_for(row, exact_ca)
        if coefficient is not None:
            ca_records += 1
        enriched.append({**row, "coefficient": coefficient})

    offset = max(0, _integer(params.get("offset"), 0))
    limit = min(100, max(10, _integer(params.get("limit"), 50)))
    items = enriched[offset: offset + limit]
    return {
        "ok": True,
        "meta": {
            **meta,
            "ca_source": "Área Total do Alvará ÷ Área do Terreno cadastral" if exact_ca else "",
            "ca_records": ca_records,
            "ca_resolved_total": ca_meta.get("resolved", 0),
        },
        "facets": facets,
        "records": {
            "filtered": len(enriched),
            "offset": offset,
            "limit": limit,
            "items": items,
        },
    }


def export_construction_csv(params: dict[str, str]) -> str:
    _, filtered, _ = _query_rows(params)
    exact_ca, _ = load_ca_lookup()
    output = io.StringIO(newline="")
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "Alvará",
        "Data de emissão",
        "Ano",
        "Tipo de alvará",
        "Área autorizada (m²)",
        "Uso",
        "Tipo de construção",
        "CA",
    ])
    for row in filtered:
        coefficient = _coefficient_for(row, exact_ca)
        writer.writerow([
            f'{row["permit"]}/{row["year"]}',
            row["date"],
            row["year"],
            row["type"],
            f'{row["area"]:.2f}'.replace(".", ","),
            row["use"],
            row["construction"],
            "" if coefficient is None else str(coefficient).replace(".", ","),
        ])
    return output.getvalue()
