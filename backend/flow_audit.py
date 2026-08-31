from __future__ import annotations

from typing import Any

from backend import analytics, core


def enrich_monthly_flow(data: dict[str, Any], query: core.Query, rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Explica as saídas mensais sem confundir fluxo com coorte.

    Cada saída operacional é classificada em:
    - same_month_outputs: protocolo aberto e concluído no mesmo mês-calendário;
    - backlog_outputs: protocolo aberto antes do mês em que foi concluído.

    A soma das duas parcelas deve reconciliar exatamente com `concluded`.
    """
    flow = data.get("charts", {}).get("flow", [])
    if not isinstance(flow, list):
        return data

    by_month = {str(item.get("month")): item for item in flow if isinstance(item, dict) and item.get("month")}
    for item in by_month.values():
        item["same_month_outputs"] = 0
        item["backlog_outputs"] = 0

    outputs_query = analytics.query_from_dashboard(query, "outputs")
    concluded = analytics.indicator_rows(outputs_query)

    for row in concluded:
        ended = core._as_date(row.get("DataConclusaoOperacional"))
        opened = core._as_date(row.get("DataAbertura"))
        if not ended:
            continue
        key = f"{ended.year:04d}-{ended.month:02d}"
        point = by_month.get(key)
        if point is None:
            continue
        if opened and opened.year == ended.year and opened.month == ended.month:
            point["same_month_outputs"] += 1
        else:
            point["backlog_outputs"] += 1

    for key, item in by_month.items():
        explained = int(item.get("same_month_outputs", 0)) + int(item.get("backlog_outputs", 0))
        total = int(item.get("concluded", 0))
        if explained != total:
            raise RuntimeError(
                f"Fluxo mensal não reconciliado em {key}: saídas={total}, composição={explained}."
            )

    data.setdefault("management", {})["flow_explanation"] = {
        "rule": "Saídas são atribuídas ao mês da conclusão operacional, independentemente do mês de abertura.",
        "same_month_label": "Abertos e concluídos no mesmo mês",
        "backlog_label": "Passivo de meses anteriores absorvido",
    }
    return data


__all__ = ["enrich_monthly_flow"]
