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
PUBLIC_FIELDS = ("permit", "date", "year", "type", "area", "use", "construction")


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


@lru_cache(maxsize=1)
def load_construction_rows() -> tuple[dict, tuple[dict, ...]]:
    parts = sorted(DATA_DIR.glob(PART_GLOB))
    if not parts:
        raise RuntimeError("Base analítica de alvarás não configurada.")
    try:
        encoded = "".join(part.read_text(encoding="ascii").strip() for part in parts)
        raw = lzma.decompress(base64.b64decode(encoded, validate=True))
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise RuntimeError("Base analítica de alvarás inválida.") from exc

    if int(payload.get("v") or 0) != 1:
        raise RuntimeError("Versão da base analítica de alvarás não reconhecida.")

    normalized: list[dict] = []
    for item in payload.get("rows", []):
        if not isinstance(item, dict):
            continue
        record = {
            "permit": _integer(item.get("permit")),
            "date": _text(item.get("date")),
            "year": _integer(item.get("year")),
            "type": _text(item.get("type")),
            "area": round(_number(item.get("area")), 2),
            "use": _text(item.get("use")),
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
    offset = max(0, _integer(params.get("offset"), 0))
    limit = min(100, max(10, _integer(params.get("limit"), 50)))
    items = filtered[offset: offset + limit]
    return {
        "ok": True,
        "meta": meta,
        "facets": facets,
        "records": {
            "filtered": len(filtered),
            "offset": offset,
            "limit": limit,
            "items": items,
        },
    }


def export_construction_csv(params: dict[str, str]) -> str:
    _, filtered, _ = _query_rows(params)
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
    ])
    for row in filtered:
        writer.writerow([
            f'{row["permit"]}/{row["year"]}',
            row["date"],
            row["year"],
            row["type"],
            f'{row["area"]:.2f}'.replace(".", ","),
            row["use"],
            row["construction"],
        ])
    return output.getvalue()
