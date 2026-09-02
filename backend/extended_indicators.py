from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import replace
from datetime import date, datetime, timedelta
import math
from typing import Any, Iterable

from backend import core
# Importa a entrada canônica antes das métricas: ela aplica o delta público
# auditado e evita que a rota de indicadores leia um universo diferente do
# dashboard/API em execuções isoladas (testes, scripts e servidor).
from backend import final_entry as _final_entry  # noqa: F401
from backend import analytics


CONTRACT = "seplanbi-indicators-v1"
INTERNAL_RESPONSIBILITY = "Fila Interna SEPLAN"
TERMINAL = {"Concluído", "Encerrado"}
DURATION_BANDS = (
    ("0–15 dias", 0, 15),
    ("16–30 dias", 16, 30),
    ("31–60 dias", 31, 60),
    ("61–90 dias", 61, 90),
    ("91–180 dias", 91, 180),
    ("181+ dias", 181, None),
)
INACTIVITY_BANDS = (
    ("0–30 dias", 0, 30),
    ("31–60 dias", 31, 60),
    ("61–90 dias", 61, 90),
    ("91–180 dias", 91, 180),
    ("181+ dias", 181, None),
)
SLA_RULES: tuple[dict[str, Any], ...] = ()


def _clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _safe_int(value: Any, default: int, low: int = 0, high: int = 3650) -> int:
    try:
        return max(low, min(high, int(value)))
    except (TypeError, ValueError):
        return default


def _percentile(values: Iterable[int], p: float) -> float | None:
    xs = sorted(int(value) for value in values)
    if not xs:
        return None
    if len(xs) == 1:
        return float(xs[0])
    pos = (len(xs) - 1) * p
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return float(xs[lo])
    return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo)


def _stats(values: Iterable[int]) -> dict[str, Any]:
    xs = [int(value) for value in values]
    return {
        "eligible": len(xs),
        "median_days": round(_percentile(xs, 0.5), 1) if xs else None,
        "mean_days": round(sum(xs) / len(xs), 1) if xs else None,
        "p90_days": round(_percentile(xs, 0.9), 1) if xs else None,
    }


def _band(days: int | None, bands=DURATION_BANDS) -> str:
    if days is None or days < 0:
        return "Não calculável"
    for label, low, high in bands:
        if days >= low and (high is None or days <= high):
            return label
    return "Não calculável"


def _group(rows: Iterable[dict[str, Any]], key, *, limit: int | None = None) -> list[dict[str, Any]]:
    counts = Counter(key(row) for row in rows)
    items = [{"name": name or "Não informado", "value": value} for name, value in counts.most_common()]
    return items if limit is None else items[:limit]


def _base_query(params: dict[str, str], indicator: str) -> analytics.AnalyticsQuery:
    raw = dict(params)
    raw["indicator"] = indicator
    return analytics.query_from_params(raw)


def _duration(row: dict[str, Any]) -> int | None:
    opened = core._as_date(row.get("DataAbertura"))
    ended = core._as_date(row.get("DataConclusaoOperacional"))
    if not opened or not ended or ended < opened:
        return None
    return (ended - opened).days


def _record(row: dict[str, Any], *, duration_days: int | None = None) -> dict[str, Any]:
    result = analytics._public_record(row)
    if duration_days is not None:
        result["duration_days"] = duration_days
    return result


def _paginate(items: list[dict[str, Any]], params: dict[str, str]) -> dict[str, Any]:
    limit = _safe_int(params.get("limit"), 50, 1, 500)
    offset = _safe_int(params.get("offset"), 0, 0, 10_000_000)
    return {"total": len(items), "offset": offset, "limit": limit, "items": items[offset: offset + limit]}


def _time_indicator(params: dict[str, str]) -> dict[str, Any]:
    query = _base_query(params, "outputs")
    rows = analytics.indicator_rows(query)
    with_duration = [(row, _duration(row)) for row in rows]
    with_duration = [(row, days) for row, days in with_duration if days is not None]
    durations = [days for _, days in with_duration]

    by_month: dict[str, list[int]] = defaultdict(list)
    by_category: dict[str, list[int]] = defaultdict(list)
    for row, days in with_duration:
        ended = core._as_date(row.get("DataConclusaoOperacional"))
        if ended:
            by_month[f"{ended.year:04d}-{ended.month:02d}"].append(days)
        by_category[_clean(row.get("Categoria")) or "Não informado"].append(days)

    monthly = [
        {"name": month, **_stats(values)}
        for month, values in sorted(by_month.items())
    ]
    categories = sorted(
        ({"name": name, **_stats(values)} for name, values in by_category.items()),
        key=lambda item: (-(item["median_days"] or 0), item["name"].casefold()),
    )
    bands = _group(
        ({"band": _band(days)} for _, days in with_duration),
        lambda item: item["band"],
    )
    records = [_record(row, duration_days=days) for row, days in with_duration]
    records.sort(key=lambda item: (item.get("duration_days", -1), item.get("protocol_id", "")), reverse=True)
    return {
        "status": "DISPONÍVEL",
        "kpi": 4,
        "name": "Tempo de tramitação",
        "rule": "Abertura até saída operacional; mediana é o KPI principal, média e P90 são contexto.",
        "metrics": _stats(durations),
        "monthly": monthly,
        "categories": categories,
        "bands": bands,
        "records": _paginate(records, params),
    }


def _stopped_indicator(params: dict[str, str]) -> dict[str, Any]:
    query = _base_query(params, "stock")
    query = replace(query, responsibilities=(INTERNAL_RESPONSIBILITY,))
    internal = analytics.indicator_rows(query)
    threshold = _safe_int(params.get("threshold"), 30, 1, 3650)
    band_filter = _clean(params.get("inactivity_band"))
    eligible = [row for row in internal if isinstance(row.get("DiasSemMovimento"), int) and row["DiasSemMovimento"] >= 0]
    stopped = [row for row in eligible if row["DiasSemMovimento"] > threshold]
    if band_filter:
        stopped = [row for row in stopped if _band(row["DiasSemMovimento"], INACTIVITY_BANDS) == band_filter]
    records = [_record(row) for row in stopped]
    records.sort(key=lambda item: (item.get("days_without_movement") or -1, item.get("protocol_id", "")), reverse=True)
    return {
        "status": "DISPONÍVEL",
        "kpi": 5,
        "name": "Processos parados",
        "rule": "Somente Fila Interna SEPLAN; Aguardando Responsável Externo e Paralisado não entram no denominador.",
        "threshold_days": threshold,
        "metrics": {
            "internal_queue": len(internal),
            "eligible": len(eligible),
            "stopped": len([row for row in eligible if row["DiasSemMovimento"] > threshold]),
            "percent": round(len([row for row in eligible if row["DiasSemMovimento"] > threshold]) / len(eligible) * 100, 1) if eligible else None,
        },
        "bands": _group(eligible, lambda row: _band(row["DiasSemMovimento"], INACTIVITY_BANDS)),
        "categories": _group(stopped, lambda row: _clean(row.get("Categoria")) or "Não informado"),
        "sectors": _group(stopped, lambda row: _clean(row.get("SetorAnalitico")) or "Não informado"),
        "records": _paginate(records, params),
    }


def _sla_indicator(params: dict[str, str]) -> dict[str, Any]:
    return {
        "status": "NÃO HOMOLOGADO",
        "kpi": 6,
        "name": "Concluídos dentro do prazo",
        "metrics": None,
        "sla_rules": list(SLA_RULES),
        "reason": "Não existe tabela oficial homologada de SLA/prazos por categoria e regras de suspensão integrada.",
        "rule": "Registros sem SLA nunca são classificados como dentro ou fora do prazo.",
    }


def _events() -> list[dict[str, Any]]:
    payload = core._load_payload()
    event_columns = payload.get("e") or {}
    if not event_columns:
        return []
    dictionaries = payload.get("d", {})
    event_types = dictionaries.get("TipoEvento", [])
    statuses = dictionaries.get("StatusOperacional", [])
    rows = core.load_rows()
    # e.p indexa o artefato-base. O overlay incremental é apensado ao final e não
    # altera os índices existentes.
    base_count = int(core.metadata().get("base_artifact_rows") or (len(rows) - len(core.metadata().get("incremental_overlay", {}).get("records", []))))
    base_rows = rows[:base_count]
    base_dt = datetime(2025, 1, 1)
    result = []
    for pidx, minutes, kidx, sidx in zip(event_columns.get("p", []), event_columns.get("a", []), event_columns.get("k", []), event_columns.get("s", [])):
        try:
            row = base_rows[int(pidx)]
            event_at = base_dt + timedelta(minutes=int(minutes))
            event_type = str(event_types[int(kidx)])
            status = str(statuses[int(sidx)])
        except (IndexError, TypeError, ValueError) as exc:
            raise RuntimeError("Evento público fora do contrato compacto.") from exc
        result.append({"protocol_id": row["ProtocoloID"], "event_at": event_at, "event_type": event_type, "status": status})
    return result


def _diligence_indicator(params: dict[str, str]) -> dict[str, Any]:
    query = _base_query(params, "received")
    public_rows = {row["ProtocoloID"]: row for row in analytics.apply_filters(analytics.canonical_rows(), query, include_period=False)}
    start, end = query.start, query.end
    events = [event for event in _events() if event["event_type"].casefold() == "diligencia"]
    events = [event for event in events if event["protocol_id"] in public_rows and start <= event["event_at"].date() <= end]
    counts = Counter(event["protocol_id"] for event in events)
    latest = {}
    for event in events:
        latest[event["protocol_id"]] = max(latest.get(event["protocol_id"], event["event_at"]), event["event_at"])
    records = []
    for protocol_id, count in counts.items():
        row = public_rows[protocol_id]
        item = _record(row)
        item.update({"diligence_count": count, "last_diligence": latest[protocol_id].isoformat(timespec="minutes")})
        records.append(item)
    records.sort(key=lambda item: (item["diligence_count"], item["last_diligence"]), reverse=True)
    repeat = Counter("4+" if count >= 4 else str(count) for count in counts.values())
    event_dates = [event["event_at"].date() for event in _events()]
    return {
        "status": "PARCIAL",
        "kpi": 7,
        "name": "Diligências por processo",
        "coverage": {
            "event_count_all_types": len(_events()),
            "from": min(event_dates).isoformat() if event_dates else None,
            "to": max(event_dates).isoformat() if event_dates else None,
            "limitation": core.metadata().get("movement_history", {}).get("limitation"),
        },
        "metrics": {
            "diligence_events": len(events),
            "protocols_with_diligence": len(counts),
            "average_per_affected_protocol": round(len(events) / len(counts), 2) if counts else 0,
            "protocols_2_plus": sum(count >= 2 for count in counts.values()),
            "protocols_3_plus": sum(count >= 3 for count in counts.values()),
        },
        "distribution": [{"name": name, "value": repeat[name]} for name in ("1", "2", "3", "4+") if repeat[name]],
        "categories": _group(records, lambda item: item.get("category") or "Não informado"),
        "records": _paginate(records, params),
    }


def _inspection_indicator(params: dict[str, str]) -> dict[str, Any]:
    query = _base_query(params, "received")
    related_query = replace(query, categories=("Fiscalização",))
    demand = analytics.indicator_rows(related_query)
    stock = analytics.indicator_rows(replace(related_query, indicator="stock", years=(), months=()))
    return {
        "status": "NÃO HOMOLOGADO",
        "kpi": 8,
        "name": "Fiscalizações realizadas",
        "reason": "A fonte pública identifica protocolos de fiscalização, mas não contém evidência auditada suficiente do ato de fiscalização/vistoria efetivamente realizado.",
        "metrics": None,
        "context": {
            "related_protocols_received": len(demand),
            "related_protocols_current_stock": len(stock),
        },
        "rule": "Protocolos relacionados nunca são convertidos automaticamente em fiscalizações realizadas.",
    }


def _complaints_indicator(params: dict[str, str]) -> dict[str, Any]:
    received_query = replace(_base_query(params, "received"), categories=("Denúncia",))
    output_query = replace(_base_query(params, "outputs"), categories=("Denúncia",))
    stock_query = replace(_base_query(params, "stock"), categories=("Denúncia",), years=(), months=())
    received = analytics.indicator_rows(received_query)
    outputs = analytics.indicator_rows(output_query)
    stock = analytics.indicator_rows(stock_query)
    durations = [days for days in (_duration(row) for row in outputs) if days is not None]
    monthly_received = Counter()
    monthly_outputs = Counter()
    for row in received:
        d = core._as_date(row.get("DataAbertura"))
        if d:
            monthly_received[f"{d.year:04d}-{d.month:02d}"] += 1
    for row in outputs:
        d = core._as_date(row.get("DataConclusaoOperacional"))
        if d:
            monthly_outputs[f"{d.year:04d}-{d.month:02d}"] += 1
    months = sorted(set(monthly_received) | set(monthly_outputs))
    records = [_record(row) for row in stock]
    records.sort(key=lambda item: (item.get("days_without_movement") or -1), reverse=True)
    return {
        "status": "DISPONÍVEL",
        "kpi": 9,
        "name": "Denúncias recebidas e respondidas",
        "metrics": {
            "received": len(received),
            "responded": len(outputs),
            "current_stock": len(stock),
            "response_rate_percent": round(len(outputs) / len(received) * 100, 1) if received else None,
            "response_time": _stats(durations),
        },
        "monthly": [{"month": month, "received": monthly_received[month], "responded": monthly_outputs[month]} for month in months],
        "statuses": _group(stock, lambda row: _clean(row.get("StatusOperacional")) or "Não informado"),
        "records": _paginate(records, params),
    }


def _projects_indicator(params: dict[str, str]) -> dict[str, Any]:
    projects = core.load_public_projects()
    phase = _clean(params.get("project_phase"))
    status = _clean(params.get("project_status"))
    interface = _clean(params.get("project_interface"))
    gabinete_interface = _clean(params.get("project_gabinete_interface"))
    group = _clean(params.get("project_group"))
    confidence = _clean(params.get("project_confidence"))
    search = _clean(params.get("q")).casefold()
    # Contrato público mínimo: mantém exatamente a tabela e o detalhamento
    # autorizados da carteira. Chaves técnicas/originais da importação não são
    # enviadas ao navegador quando não são necessárias para a leitura gerencial.
    normalized = [{
        "ID": item.get("id", item.get("ID", "")),
        "Projeto": item.get("project", item.get("ID", "")),
        "Grupo": item.get("group", ""),
        "Interface": item.get("interface", ""),
        "GabineteInterface": item.get("gabinete_interface", ""),
        "FaseAtual": item.get("phase", item.get("FaseAtual", "")),
        "StatusAtual": item.get("status", item.get("StatusAtual", "")),
        "AtividadeAtual": item.get("current_activity", ""),
        "DependenciaBloqueio": item.get("blocker", ""),
        "EvidenciaAtual": item.get("evidence", ""),
        "FonteDetalhamento": item.get("source_detail", ""),
        "ObservacaoAuditoria": item.get("audit_note", ""),
        "DataReferencia": item.get("reference_date", item.get("DataReferencia", "")),
        "Confianca": item.get("confidence", ""),
    } for item in projects]
    def matches(item: dict[str, Any]) -> bool:
        if phase and item["FaseAtual"] != phase:
            return False
        if status and item["StatusAtual"] != status:
            return False
        if interface and item["Interface"] != interface:
            return False
        if gabinete_interface and item["GabineteInterface"] != gabinete_interface:
            return False
        if group and item["Grupo"] != group:
            return False
        if confidence and item["Confianca"] != confidence:
            return False
        if search:
            searchable = " ".join(str(item.get(key, "")) for key in ("Projeto", "Interface", "Grupo", "FaseAtual", "StatusAtual"))
            if search not in searchable.casefold():
                return False
        return True

    selected = [item for item in normalized if matches(item)]
    selected = sorted(selected, key=lambda item: str(item["ID"]))
    refs = sorted({item["DataReferencia"] for item in normalized})
    return {
        "status": "DISPONÍVEL",
        "kpi": 10,
        "name": "Projetos públicos por etapa",
        "metrics": {"projects": len(projects), "selected": len(selected), "reference_date": refs[0] if len(refs) == 1 else None},
        "phases": _group(selected, lambda item: item["FaseAtual"]),
        "statuses": _group(selected, lambda item: item["StatusAtual"]),
        "interfaces": _group(selected, lambda item: item["Interface"]),
        "gabinete_interfaces": _group([item for item in selected if item["Interface"] == "Gabinete"], lambda item: item["GabineteInterface"] or "Não informado"),
        "groups": _group(selected, lambda item: item["Grupo"]),
        "confidences": _group(selected, lambda item: item["Confianca"]),
        "records": _paginate(selected, params),
        "rule": "Carteira específica de 20 projetos; protocolos IPM não são usados como proxy de projeto único.",
    }


def _matrix(rows: list[dict[str, Any]], row_dimension: str, column_dimension: str) -> dict[str, Any]:
    allowed = {
        "sector": lambda row: _clean(row.get("SetorAnalitico")) or "Não informado",
        "category": lambda row: _clean(row.get("Categoria")) or "Não informado",
        "macroprocess": lambda row: _clean(row.get("Macroprocesso")) or "Não informado",
        "responsibility": lambda row: _clean(row.get("ResponsabilidadeOperacional")) or "Não informado",
        "status": lambda row: _clean(row.get("StatusOperacional")) or "Não informado",
        "age_band": lambda row: _band(row.get("DiasSemMovimento"), INACTIVITY_BANDS),
    }
    if row_dimension not in allowed:
        row_dimension = "category"
    if column_dimension not in allowed or column_dimension == row_dimension:
        column_dimension = "status" if row_dimension != "status" else "age_band"
    cells = Counter((allowed[row_dimension](row), allowed[column_dimension](row)) for row in rows)
    row_values = sorted({key[0] for key in cells}, key=str.casefold)
    column_values = sorted({key[1] for key in cells}, key=str.casefold)
    return {
        "row_dimension": row_dimension,
        "column_dimension": column_dimension,
        "rows": row_values,
        "columns": column_values,
        "cells": [{"row": row, "column": column, "value": cells[(row, column)]} for row in row_values for column in column_values if cells[(row, column)]],
    }


def _responsibility_indicator(params: dict[str, str]) -> dict[str, Any]:
    query = _base_query(params, "stock")
    rows = analytics.indicator_rows(query)
    row_dimension = _clean(params.get("row_dimension")).casefold() or "category"
    column_dimension = _clean(params.get("column_dimension")).casefold() or "status"
    records = [_record(row) for row in rows]
    records.sort(key=lambda item: (item.get("days_without_movement") or -1), reverse=True)
    return {
        "status": "DISPONÍVEL",
        "kpi": 11,
        "name": "Pendências por responsável / setor",
        "metrics": analytics.control_totals(query),
        "responsibilities": _group(rows, lambda row: row.get("ResponsabilidadeOperacional") or "Não informado"),
        "sectors": _group(rows, lambda row: row.get("SetorAnalitico") or "Não informado"),
        "categories": _group(rows, lambda row: row.get("Categoria") or "Não informado"),
        "matrix": _matrix(rows, row_dimension, column_dimension),
        "records": _paginate(records, params),
        "rule": "Concentração operacional, não ranking de desempenho individual.",
    }


def extended_indicator_response(params: dict[str, str]) -> dict[str, Any]:
    kpi = _safe_int(params.get("kpi"), 4, 4, 11)
    builders = {
        4: _time_indicator,
        5: _stopped_indicator,
        6: _sla_indicator,
        7: _diligence_indicator,
        8: _inspection_indicator,
        9: _complaints_indicator,
        10: _projects_indicator,
        11: _responsibility_indicator,
    }
    payload = builders[kpi](params)
    return {
        "ok": True,
        "contract": CONTRACT,
        "meta": {
            "source_rows": len(core.load_rows()),
            "source_updated_at": core.metadata().get("source_updated_at"),
            "taxonomy_version": core.metadata().get("semantic_memory", {}).get("taxonomy_version"),
            "privacy": "public-sanitized-no-pii",
        },
        **payload,
    }


__all__ = ["CONTRACT", "SLA_RULES", "extended_indicator_response"]
