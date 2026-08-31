from __future__ import annotations

from collections import defaultdict
from dataclasses import replace
from typing import Any

from backend import analytics, core
from backend.extended_indicators import extended_indicator_response


def _duration(row: dict[str, Any]) -> int | None:
    opened = core._as_date(row.get("DataAbertura"))
    ended = core._as_date(row.get("DataConclusaoOperacional"))
    if not opened or not ended or ended < opened:
        return None
    return (ended - opened).days


def _percentile(values: list[int], p: float) -> float | None:
    xs = sorted(values)
    if not xs:
        return None
    if len(xs) == 1:
        return float(xs[0])
    position = (len(xs) - 1) * p
    lower = int(position)
    upper = min(lower + 1, len(xs) - 1)
    fraction = position - lower
    return xs[lower] + (xs[upper] - xs[lower]) * fraction


def _stats(rows: list[dict[str, Any]]) -> dict[str, Any]:
    durations = [days for days in (_duration(row) for row in rows) if days is not None]
    if not durations:
        return {"eligible": 0, "median_days": None, "mean_days": None, "p90_days": None}
    return {
        "eligible": len(durations),
        "median_days": round(_percentile(durations, 0.5) or 0, 1),
        "mean_days": round(sum(durations) / len(durations), 1),
        "p90_days": round(_percentile(durations, 0.9) or 0, 1),
    }


def _monthly_stats(rows: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    grouped: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        ended = core._as_date(row.get("DataConclusaoOperacional"))
        if ended:
            grouped[ended.month].append(row)
    return {month: _stats(group) for month, group in grouped.items()}


def _time_comparison(params: dict[str, str]) -> dict[str, Any] | None:
    raw = dict(params)
    raw["indicator"] = "outputs"
    query = analytics.query_from_params(raw)

    # Uma seleção explícita por ano muda o universo temporal. Nesse caso a
    # comparação homóloga automática é omitida para não misturar dois recortes.
    if query.years:
        return None

    current_rows = analytics.indicator_rows(query)
    previous_query = replace(
        query,
        start=analytics._shift_previous_year(query.start),
        end=analytics._shift_previous_year(query.end),
        years=(),
    )
    previous_rows = analytics.indicator_rows(previous_query)

    current_stats = _stats(current_rows)
    previous_stats = _stats(previous_rows)
    current_monthly = _monthly_stats(current_rows)
    previous_monthly = _monthly_stats(previous_rows)
    months = sorted(set(current_monthly) | set(previous_monthly))

    current_median = current_stats["median_days"]
    previous_median = previous_stats["median_days"]
    median_change_days = None
    median_change_percent = None
    if current_median is not None and previous_median is not None:
        median_change_days = round(current_median - previous_median, 1)
        if previous_median:
            median_change_percent = round((current_median - previous_median) / previous_median * 100, 1)

    return {
        "current": {
            "from": query.start.isoformat(),
            "to": query.end.isoformat(),
            **current_stats,
        },
        "previous": {
            "from": previous_query.start.isoformat(),
            "to": previous_query.end.isoformat(),
            **previous_stats,
        },
        "median_change_days": median_change_days,
        "median_change_percent": median_change_percent,
        "monthly": [
            {
                "month": month,
                "current": current_monthly.get(month, {}).get("median_days"),
                "previous": previous_monthly.get(month, {}).get("median_days"),
                "current_eligible": current_monthly.get(month, {}).get("eligible", 0),
                "previous_eligible": previous_monthly.get(month, {}).get("eligible", 0),
            }
            for month in months
        ],
        "rule": "Mesmo intervalo de datas deslocado em um ano; mediana calculada apenas sobre saídas operacionais elegíveis em cada período.",
    }


def indicator_view_response(params: dict[str, str]) -> dict[str, Any]:
    payload = extended_indicator_response(params)
    if payload.get("kpi") == 4:
        payload["comparison"] = _time_comparison(params)
    return payload


__all__ = ["indicator_view_response"]
