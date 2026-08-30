from collections import Counter
from functools import lru_cache
import json

from backend import core
from backend.final_data import load_rows as load_rows_base


DELTA_PATH = core.DATA_DIR / "incremental_public.json"
_ALLOWED_DELTA_FIELDS = {
    "ProtocoloID",
    "NumeroAnoOriginal",
    "ProtocoloAno",
    "DataAbertura",
    "UltimoTramiteDataHora",
    "DataEncerramento",
    "DataSaida",
    "TipoSaida",
    "Macroprocesso",
    "Categoria",
    "StatusOperacional",
    "SetorAtual",
    "GargaloOperacional",
    "DiasSemMovimento",
    "SourceFingerprint",
}


@lru_cache(maxsize=1)
def _load_incremental_public():
    if not DELTA_PATH.is_file():
        return {"v": 1, "records": []}
    try:
        payload = json.loads(DELTA_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError("Carga bloqueada: delta público incremental inválido.") from exc
    if payload.get("v") != 1 or not isinstance(payload.get("records"), list):
        raise RuntimeError("Carga bloqueada: contrato incremental público v1 esperado.")
    for row in payload["records"]:
        unknown = set(row).difference(_ALLOWED_DELTA_FIELDS)
        forbidden = core.FORBIDDEN_KEYS.intersection(row)
        if unknown or forbidden:
            raise RuntimeError(
                f"Carga bloqueada: campo não autorizado no delta público: {sorted(unknown | forbidden)}"
            )
    return payload


# O analytics lê a data de referência antes de chamar core.load_rows(). Por isso,
# a referência efetiva do snapshot precisa ser promovida ainda na importação deste
# módulo; source_rows permanece descrevendo o artefato-base até a reconciliação.
_EFFECTIVE_DELTA = _load_incremental_public()
_EFFECTIVE_DATE = core._clean(_EFFECTIVE_DELTA.get("source_updated_at"))
if _EFFECTIVE_DATE:
    _meta = core.metadata()
    _meta["source_updated_at"] = _EFFECTIVE_DATE
    _meta.setdefault("default_period", {})["to"] = _EFFECTIVE_DATE


@lru_cache(maxsize=1)
def load_rows():
    delta = _EFFECTIVE_DELTA
    metadata = core.metadata()
    expected_base = int(metadata.get("source_rows", -1))

    # O artefato compacto permanece imutável; o delta contém somente protocolos
    # novos já auditados e sanitizados. Isso permite atualização incremental sem
    # republicar PII nem reclassificar a memória histórica.
    rows = [dict(row) for row in load_rows_base()]
    base_rows = len(rows)
    if base_rows != expected_base:
        raise RuntimeError("Carga bloqueada: artefato-base diverge dos metadados.")

    seen = {core._clean(row.get("ProtocoloID")) for row in rows}
    for item in delta.get("records", []):
        protocol_id = core._clean(item.get("ProtocoloID"))
        if not protocol_id or protocol_id in seen:
            raise RuntimeError(f"Carga bloqueada: protocolo incremental inválido/duplicado {protocol_id!r}.")
        rows.append(dict(item))
        seen.add(protocol_id)

    audit = core._audit_rows(rows)
    if not audit["ok"]:
        raise RuntimeError(f"Carga bloqueada pela auditoria incremental: {audit}")

    categories = {core._clean(row.get("Categoria")) for row in rows}
    expected_categories = int(metadata.get("semantic_memory", {}).get("category_count", -1))
    if len(categories) != expected_categories:
        raise RuntimeError("Carga bloqueada: taxonomia V07 não reconciliada.")

    # Atualiza em memória somente os metadados efetivos do snapshot. O manifesto
    # do artefato-base continua descrevendo os 7.063 registros compactados.
    source_updated_at = _EFFECTIVE_DATE or metadata.get("source_updated_at")
    metadata["base_artifact_rows"] = base_rows
    metadata["source_rows"] = len(rows)
    metadata["source_updated_at"] = source_updated_at
    metadata.setdefault("default_period", {})["to"] = source_updated_at
    metadata["years"] = dict(sorted(Counter(str(row.get("ProtocoloAno")) for row in rows).items()))

    status_counts = Counter(core._clean(row.get("StatusOperacional")) for row in rows)
    metadata.setdefault("semantic_memory", {})["status_counts"] = dict(status_counts)
    import_audit = metadata.setdefault("import_audit", {})
    import_audit.update({
        "protocols_2025_plus": len(rows),
        "unique_protocols": len(seen),
        "received_2026_to_cutoff": sum(int(row.get("ProtocoloAno") or 0) == 2026 for row in rows),
        "outputs_total": sum(core._clean(row.get("StatusOperacional")) in {"Concluído", "Encerrado"} for row in rows),
        "stock": sum(core._clean(row.get("StatusOperacional")) not in {"Concluído", "Encerrado"} for row in rows),
        "status_counts": dict(status_counts),
        "incremental_update": delta.get("audit", {}),
    })
    metadata["incremental_overlay"] = {
        "file": DELTA_PATH.name,
        "records": len(delta.get("records", [])),
        "source_updated_at": source_updated_at,
        "privacy": "allowlist-sanitized-no-pii",
    }
    return rows


# Injeta a fonte canônica reconciliada antes de calcular as métricas.
core.load_rows = load_rows

from backend.delivery_v07 import dashboard, health, query_from_params  # noqa: E402,F401
