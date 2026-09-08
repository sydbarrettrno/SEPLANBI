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
    "Residencial unifamiliar": "Residencial — não especificado",
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


def _ca_lookup() -> tuple[dict[tuple[int, int, str, str], float], dict[tuple[int, int], float]]:
    """Extrai somente o CA estimado da base cadastral privada.

    Nenhum campo nominal, cadastral ou de endereço é devolvido pelo contrato público.
    O fallback por alvará/ano só é aceito quando todos os registros cruzados daquele
    alvará possuem o mesmo CA, evitando associação ambígua.
    """
    try:
        from backend.construction_private import load_private_construction

        _, private_rows = load_private_construction()
    except Exception:
        return {}, {}

    exact: dict[tuple[int, int, str, str], float] = {}
    candidates: dict[tuple[int, int], set[float]] = {}

    for row in private_rows:
        permit = _integer(row.get("permit"))
        year = _integer(row.get("year"))
        date = _text(row.get("date"))
        permit_type = _text(row.get("permit_type"))
        ca = _optional_number(row.get("ca_estimated"))
        if not permit or not year or ca is None:
            continue
        value = round(ca, 3)
        exact[(permit, year, date, permit_type)] = value
        candidates.setdefault((permit, year), set()).add(value)

    unambiguous = {
        key: next(iter(values))
        for key, values in candidates.items()
        if len(values) == 1
    }
    return exact, unambiguous


def _coefficient_for(row: dict, exact: dict, unambiguous: dict) -> float | None:
    exact_key = (row["permit"], row["year"], row["date"], row["type"])
    if exact_key in exact:
        return exact[exact_key]
    return unambiguous.get((row["permit"], row["year"]))


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
    exact_ca, unambiguous_ca = _ca_lookup()

    enriched: list[dict] = []
    ca_records = 0
    for row in filtered:
        coefficient = _coefficient_for(row, exact_ca, unambiguous_ca)
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
            "ca_source": "Cadastro Imobiliário cruzado" if exact_ca or unambiguous_ca else "",
            "ca_records": ca_records,
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
    exact_ca, unambiguous_ca = _ca_lookup()
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
        "CA estimado",
    ])
    for row in filtered:
        coefficient = _coefficient_for(row, exact_ca, unambiguous_ca)
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
