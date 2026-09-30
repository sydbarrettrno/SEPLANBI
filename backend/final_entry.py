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
        return {"v": 2, "mode": "upsert", "records": []}
    try:
        payload = json.loads(DELTA_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError("Carga bloqueada: delta público incremental inválido.") from exc

    version = int(payload.get("v") or 0)
    if version not in {1, 2} or not isinstance(payload.get("records"), list):
        raise RuntimeError("Carga bloqueada: contrato incremental público v1/v2 esperado.")
    if version == 2 and payload.get("mode") != "upsert":
        raise RuntimeError("Carga bloqueada: overlay público v2 deve operar em modo upsert.")

    for row in payload["records"]:
        if not isinstance(row, dict):
            raise RuntimeError("Carga bloqueada: registro incremental inválido.")
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

    index_by_id = {
        core._clean(row.get("ProtocoloID")): index
        for index, row in enumerate(rows)
    }
    overlay_seen: set[str] = set()
    replaced = 0
    added = 0
    version = int(delta.get("v") or 1)

    for item in delta.get("records", []):
        protocol_id = core._clean(item.get("ProtocoloID"))
        if not protocol_id or protocol_id in overlay_seen:
            raise RuntimeError(f"Carga bloqueada: protocolo incremental inválido/duplicado {protocol_id!r}.")
        overlay_seen.add(protocol_id)

        if protocol_id in index_by_id:
            if version == 1:
                raise RuntimeError(
                    f"Carga bloqueada: protocolo incremental v1 já existe no artefato-base {protocol_id!r}."
                )
            rows[index_by_id[protocol_id]] = dict(item)
            replaced += 1
        else:
            index_by_id[protocol_id] = len(rows)
            rows.append(dict(item))
            added += 1

    audit = core._audit_rows(rows)
    if not audit["ok"]:
        raise RuntimeError(f"Carga bloqueada pela auditoria incremental: {audit}")

    categories = {core._clean(row.get("Categoria")) for row in rows}
    expected_categories = int(metadata.get("semantic_memory", {}).get("category_count", -1))
    if len(categories) != expected_categories:
        raise RuntimeError("Carga bloqueada: taxonomia V07 não reconciliada.")

    expected_effective = int(delta.get("expected_effective_rows") or 0)
    if expected_effective and len(rows) != expected_effective:
        raise RuntimeError(
            f"Carga bloqueada: total reconciliado {len(rows)} diverge do esperado {expected_effective}."
        )

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
        "unique_protocols": len(index_by_id),
        "received_2026_to_cutoff": sum(int(row.get("ProtocoloAno") or 0) == 2026 for row in rows),
        "outputs_total": sum(core._clean(row.get("StatusOperacional")) in {"Concluído", "Encerrado"} for row in rows),
        "stock": sum(core._clean(row.get("StatusOperacional")) not in {"Concluído", "Encerrado"} for row in rows),
        "status_counts": dict(status_counts),
        "incremental_update": {
            **delta.get("audit", {}),
            "replaced_existing": replaced,
            "added_new": added,
        },
    })
    metadata["incremental_overlay"] = {
        "file": DELTA_PATH.name,
        "version": version,
        "mode": delta.get("mode", "append-only"),
        "records": len(delta.get("records", [])),
        "replaced_existing": replaced,
        "added_new": added,
        "source_updated_at": source_updated_at,
        "privacy": "allowlist-sanitized-no-pii",
    }
    return rows


# Injeta a fonte canônica reconciliada antes de calcular as métricas.
core.load_rows = load_rows

from backend.delivery_v07 import dashboard, health, query_from_params  # noqa: E402,F401
