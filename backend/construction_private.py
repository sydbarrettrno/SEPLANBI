from __future__ import annotations

import csv
import io
import json
import lzma
import os
import statistics
import unicodedata
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

BLOB_PATH = "private/construction_alvaras_v1.xz"
MAX_ROWS = 50_000

REQUIRED_HEADERS = {
    "Alvará",
    "Data de Emissão",
    "Ano",
    "Tipo de Alvará",
    "Área do Alvará (m²)",
    "Titular da Obra",
    "Uso/Finalidade",
    "Uso Normalizado",
    "CA Estimado",
    "Status CA",
}


def _text(value: Any) -> str:
    return str(value or "").strip()


def _ascii_upper(value: Any) -> str:
    text = unicodedata.normalize("NFKD", _text(value)).encode("ascii", "ignore").decode("ascii")
    return text.upper()


def normalize_use(value: Any) -> str:
    raw = _ascii_upper(value)
    if raw == "RESIDENCIAL":
        return "Residencial unifamiliar"
    if raw == "RESIDENCIAL (MULTIFAMILIAR)":
        return "Residencial multifamiliar"
    if "RESIDENCIAL" in raw and "COMERCIAL" in raw:
        return "Misto residencial/comercial"
    if raw.startswith("COMERCIAL") or raw == "SERVICOS":
        return "Comercial/Serviços"
    if "INDUSTRIAL" in raw:
        return "Industrial"
    if "PORTU" in raw:
        return "Portuário"
    if "GALP" in raw:
        return "Galpão — uso não especificado"
    if raw in {
        "EDIFICACAO PUBLICA", "UNIDADE ESCOLAR", "RELIGIOSO", "RELIGIOSA",
        "SAUDE", "QUADRA POLIESPORTIVA", "GINASIO DE ESPORTES", "ESPORTE/LAZER",
    }:
        return "Institucional/Equipamentos"
    if raw == "POUSADA":
        return "Hospedagem"
    if raw in {"DESDOBRO", "DESMEMBRAMENTO", "UNIFICACAO", "RETIFICACAO", "LOTEAMENTO"}:
        return "Parcelamento/ajuste cadastral"
    return "Outros"


def _number(value: Any) -> float | None:
    text = _text(value)
    if not text:
        return None
    try:
        return float(text.replace(".", "").replace(",", "."))
    except ValueError:
        return None


def _integer(value: Any, default: int = 0) -> int:
    try:
        return int(float(_text(value)))
    except (TypeError, ValueError):
        return default


def _iso_date(value: Any) -> str:
    text = _text(value)
    if not text:
        return ""
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


def _payload_to_blob(payload: dict[str, Any]) -> None:
    if not os.getenv("BLOB_READ_WRITE_TOKEN"):
        raise RuntimeError("Armazenamento privado não configurado no servidor.")
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    compressed = lzma.compress(raw, preset=6)
    try:
        from vercel.blob import BlobClient
        with BlobClient() as client:
            client.put(
                BLOB_PATH,
                compressed,
                access="private",
                content_type="application/x-xz",
                overwrite=True,
            )
    except Exception as exc:
        raise RuntimeError("Não foi possível gravar a base privada de alvarás.") from exc


def _blob_to_payload() -> dict[str, Any]:
    if not os.getenv("BLOB_READ_WRITE_TOKEN"):
        raise RuntimeError("Armazenamento privado não configurado no servidor.")
    try:
        from vercel.blob import BlobClient
        from vercel.blob.errors import BlobNotFoundError
        with BlobClient() as client:
            result = client.get(BLOB_PATH, access="private", timeout=8, use_cache=False)
    except BlobNotFoundError as exc:
        raise RuntimeError("Base privada de alvarás ainda não foi carregada.") from exc
    except Exception as exc:
        raise RuntimeError("Base privada de alvarás temporariamente indisponível.") from exc
    if result is None or result.status_code == 404:
        raise RuntimeError("Base privada de alvarás ainda não foi carregada.")
    if result.status_code != 200:
        raise RuntimeError("Armazenamento privado recusou a leitura da base de alvarás.")
    try:
        return json.loads(lzma.decompress(bytes(result.content)).decode("utf-8"))
    except Exception as exc:
        raise RuntimeError("Base privada de alvarás armazenada está inválida.") from exc


def _record_from_source(source: dict[str, Any]) -> dict[str, Any]:
    permit_id = _text(source.get("Alvará"))
    parts = permit_id.replace("-", "/").split("/", 1)
    permit = _integer(parts[0]) if parts else 0
    year = _integer(source.get("Ano"))
    date = _iso_date(source.get("Data de Emissão"))
    raw_use = _text(source.get("Uso/Finalidade"))
    normalized_use = normalize_use(raw_use)
    ca = _number(source.get("CA Estimado"))
    lot_area = _number(source.get("Área do Terreno Cruzada (m²)"))
    authorized_area = _number(source.get("Área do Alvará (m²)"))
    existing_area = _number(source.get("Área Existente (m²)"))
    reference_area = _number(source.get("Área de Referência CA (m²)"))

    return {
        "permit": permit,
        "permit_id": f"{permit}/{year}" if permit and year else permit_id,
        "date": date,
        "year": year,
        "permit_type": _text(source.get("Tipo de Alvará")),
        "authorized_area_m2": round(authorized_area, 2) if authorized_area is not None else None,
        "existing_area_m2": round(existing_area, 2) if existing_area is not None else None,
        "applicant": _text(source.get("Titular da Obra")),
        "use_raw": raw_use,
        "use": normalized_use,
        "construction_type": _text(source.get("Tipo de Construção")),
        "cadastre_permit": _text(source.get("Cadastro no Alvará")),
        "registration_permit": _text(source.get("Inscrição no Alvará")),
        "street_permit": _text(source.get("Logradouro no Alvará")),
        "number_permit": _text(source.get("Número no Alvará")),
        "link_status": _text(source.get("Status do Cruzamento")),
        "link_method": _text(source.get("Método do Cruzamento")),
        "link_confidence": _text(source.get("Confiança")),
        "linked_parcels": _integer(source.get("Qtd. Terrenos Vinculados")),
        "current_cadastre": _text(source.get("Cadastro(s) do Terreno Atual")),
        "current_registration": _text(source.get("Inscrição(ões) Atual(is)")),
        "lot_area_m2": round(lot_area, 2) if lot_area is not None else None,
        "current_owner": _text(source.get("Proprietário Cadastral Atual")),
        "current_document": _text(source.get("CPF/CNPJ Cadastral Atual")),
        "owner_code": _text(source.get("Código do Proprietário")),
        "neighborhood": _text(source.get("Bairro Atual")),
        "block": _text(source.get("Quadra Atual")),
        "lot": _text(source.get("Lote(s) Atual(is)")),
        "linked_cadastre_type": _text(source.get("Tipo de Cadastro Vinculado")),
        "land_code_when_unit": _text(source.get("Cód. Terreno (quando unidade)")),
        "ca_reference_area_m2": round(reference_area, 2) if reference_area is not None else None,
        "ca_estimated": round(ca, 3) if ca is not None else None,
        "ca_band": _text(source.get("Faixa CA")),
        "ca_status": _text(source.get("Status CA")),
        "outorga": _text(source.get("Outorga Onerosa")) or "N/D na fonte",
    }


def install_private_csv(body: bytes, source_name: str = "") -> dict[str, Any]:
    if not body:
        raise ValueError("Arquivo vazio.")
    try:
        text = body.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("A base deve estar em CSV UTF-8.") from exc
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    headers = set(reader.fieldnames or [])
    if not REQUIRED_HEADERS.issubset(headers):
        missing = sorted(REQUIRED_HEADERS - headers)
        raise ValueError("Base incompatível. Campos ausentes: " + ", ".join(missing))

    records: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for source in reader:
        record = _record_from_source(source)
        if not record["permit"] or not record["year"] or not record["date"]:
            continue
        key = (record["permit_id"], record["date"], record["permit_type"])
        if key in seen:
            continue
        seen.add(key)
        records.append(record)
        if len(records) > MAX_ROWS:
            raise ValueError("A base excede o limite operacional de registros.")

    if not records:
        raise ValueError("Nenhum alvará válido foi encontrado na base.")
    records.sort(key=lambda row: (row["date"], row["permit"]), reverse=True)
    installed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    payload = {
        "v": 1,
        "records": records,
        "meta": {
            "source": "Sistema IPM + Cadastro Imobiliário",
            "source_name": _text(source_name)[:180],
            "installed_at": installed_at,
            "rows": len(records),
            "current_cut": max(row["date"] for row in records),
        },
    }
    _payload_to_blob(payload)
    load_private_construction.cache_clear()
    return {
        "ok": True,
        "configured": True,
        "rows": len(records),
        "installed_at": installed_at,
        "current_cut": payload["meta"]["current_cut"],
    }


@lru_cache(maxsize=1)
def load_private_construction() -> tuple[dict[str, Any], tuple[dict[str, Any], ...]]:
    payload = _blob_to_payload()
    if int(payload.get("v") or 0) != 1:
        raise RuntimeError("Contrato da base privada de alvarás não reconhecido.")
    records = payload.get("records")
    if not isinstance(records, list) or not records:
        raise RuntimeError("Base privada de alvarás vazia.")
    return dict(payload.get("meta") or {}), tuple(dict(row) for row in records if isinstance(row, dict))


def private_status() -> dict[str, Any]:
    try:
        meta, records = load_private_construction()
        return {"ok": True, "configured": True, "rows": len(records), "meta": meta}
    except RuntimeError:
        return {"ok": True, "configured": False, "rows": 0, "meta": {}}


def _change(previous: float | int | None, current: float | int | None) -> float | None:
    if previous is None or current is None or previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 1)


def _comparison(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def period(year: int) -> list[dict[str, Any]]:
        start = f"{year}-01-01"
        end = f"{year}-09-03"
        return [row for row in records if start <= _text(row.get("date")) <= end]

    p25, p26 = period(2025), period(2026)
    n25 = [row for row in p25 if row.get("permit_type") == "CONSTRUÇÃO"]
    n26 = [row for row in p26 if row.get("permit_type") == "CONSTRUÇÃO"]

    def area(rows):
        return round(sum(float(row.get("authorized_area_m2") or 0) for row in rows), 2)

    def use_count(rows, label):
        return sum(1 for row in rows if row.get("use") == label)

    def ca_median(rows):
        values = [float(row["ca_estimated"]) for row in rows if row.get("ca_estimated") is not None]
        return round(statistics.median(values), 3) if values else None

    items = [
        ("Alvarás totais", len(p25), len(p26), "count"),
        ("Construção nova", len(n25), len(n26), "count"),
        ("Área autorizada", area(n25), area(n26), "m2"),
        ("Residencial unifamiliar", use_count(n25, "Residencial unifamiliar"), use_count(n26, "Residencial unifamiliar"), "count"),
        ("Residencial multifamiliar", use_count(n25, "Residencial multifamiliar"), use_count(n26, "Residencial multifamiliar"), "count"),
        ("CA estimado mediano", ca_median(n25), ca_median(n26), "coefficient"),
    ]
    return [
        {"label": label, "previous": previous, "current": current, "change_percent": _change(previous, current), "unit": unit}
        for label, previous, current, unit in items
    ]


def _query(params: dict[str, str]) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, list[Any]], list[dict[str, Any]]]:
    meta, tuple_rows = load_private_construction()
    rows = list(tuple_rows)
    q = _text(params.get("q")).casefold()
    year = _integer(params.get("year"))
    permit_type = _text(params.get("type"))
    use = _text(params.get("use"))
    neighborhood = _text(params.get("neighborhood"))
    ca_band = _text(params.get("ca_band"))

    filtered: list[dict[str, Any]] = []
    for row in rows:
        if year and _integer(row.get("year")) != year:
            continue
        if permit_type and _text(row.get("permit_type")) != permit_type:
            continue
        if use and _text(row.get("use")) != use:
            continue
        if neighborhood and _text(row.get("neighborhood")) != neighborhood:
            continue
        if ca_band and _text(row.get("ca_band")) != ca_band:
            continue
        if q:
            haystack = " ".join(_text(row.get(key)) for key in (
                "permit_id", "applicant", "permit_type", "use", "construction_type",
                "cadastre_permit", "registration_permit", "street_permit", "neighborhood",
                "current_owner", "current_document", "block", "lot",
            )).casefold()
            if q not in haystack:
                continue
        filtered.append(row)

    facets = {
        "years": sorted({_integer(row.get("year")) for row in rows if _integer(row.get("year"))}, reverse=True),
        "types": sorted({_text(row.get("permit_type")) for row in rows if _text(row.get("permit_type"))}),
        "uses": sorted({_text(row.get("use")) for row in rows if _text(row.get("use"))}),
        "neighborhoods": sorted({_text(row.get("neighborhood")) for row in rows if _text(row.get("neighborhood"))}),
        "ca_bands": sorted({_text(row.get("ca_band")) for row in rows if _text(row.get("ca_band"))}),
    }
    return meta, filtered, facets, _comparison(rows)


def private_data_response(params: dict[str, str]) -> dict[str, Any]:
    meta, filtered, facets, comparison = _query(params)
    offset = max(0, _integer(params.get("offset"), 0))
    limit = min(100, max(10, _integer(params.get("limit"), 25)))
    return {
        "ok": True,
        "meta": meta,
        "facets": facets,
        "comparison": comparison,
        "records": {
            "filtered": len(filtered),
            "offset": offset,
            "limit": limit,
            "items": filtered[offset:offset + limit],
        },
    }


def export_private_csv(params: dict[str, str]) -> str:
    _, filtered, _, _ = _query(params)
    output = io.StringIO(newline="")
    fields = [
        "permit_id", "date", "year", "permit_type", "authorized_area_m2", "existing_area_m2",
        "applicant", "use_raw", "use", "construction_type", "cadastre_permit", "registration_permit",
        "street_permit", "number_permit", "link_status", "link_method", "link_confidence", "linked_parcels",
        "current_cadastre", "current_registration", "lot_area_m2", "current_owner", "current_document",
        "owner_code", "neighborhood", "block", "lot", "linked_cadastre_type", "land_code_when_unit",
        "ca_reference_area_m2", "ca_estimated", "ca_band", "ca_status", "outorga",
    ]
    labels = {
        "permit_id": "Alvará", "date": "Data de Emissão", "year": "Ano", "permit_type": "Tipo de Alvará",
        "authorized_area_m2": "Área do Alvará (m²)", "existing_area_m2": "Área Existente (m²)",
        "applicant": "Solicitante/Titular", "use_raw": "Uso Original", "use": "Uso Normalizado",
        "construction_type": "Tipo de Construção", "cadastre_permit": "Cadastro no Alvará",
        "registration_permit": "Inscrição no Alvará", "street_permit": "Logradouro no Alvará",
        "number_permit": "Número no Alvará", "link_status": "Status do Cruzamento",
        "link_method": "Método do Cruzamento", "link_confidence": "Confiança", "linked_parcels": "Qtd. Terrenos Vinculados",
        "current_cadastre": "Cadastro(s) Atual(is)", "current_registration": "Inscrição(ões) Atual(is)",
        "lot_area_m2": "Área do Terreno Cruzada (m²)", "current_owner": "Proprietário Cadastral Atual",
        "current_document": "CPF/CNPJ Cadastral Atual", "owner_code": "Código do Proprietário",
        "neighborhood": "Bairro Atual", "block": "Quadra Atual", "lot": "Lote(s) Atual(is)",
        "linked_cadastre_type": "Tipo de Cadastro Vinculado", "land_code_when_unit": "Cód. Terreno (quando unidade)",
        "ca_reference_area_m2": "Área de Referência CA (m²)", "ca_estimated": "CA Estimado",
        "ca_band": "Faixa CA", "ca_status": "Status CA", "outorga": "Outorga Onerosa",
    }
    writer = csv.writer(output, delimiter=";")
    writer.writerow([labels[field] for field in fields])
    for row in filtered:
        values = []
        for field in fields:
            value = row.get(field, "")
            if isinstance(value, float):
                value = str(value).replace(".", ",")
            values.append(value)
        writer.writerow(values)
    return output.getvalue()


__all__ = [
    "install_private_csv",
    "load_private_construction",
    "private_status",
    "private_data_response",
    "export_private_csv",
]
