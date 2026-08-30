from __future__ import annotations

from backend import core
from backend import analytics
from backend import delivery_core as base

query_from_params = base.query_from_params


def _period_rows(rows, field, query):
    return [r for r in rows if core._in_period(r.get(field), query.start, query.end)]


def dashboard(query):
    data = base.dashboard(query)

    rows = base._rows()
    received_query = analytics.query_from_dashboard(query, "received")
    outputs_query = analytics.query_from_dashboard(query, "outputs")
    stock_query = analytics.query_from_dashboard(query, "stock")
    received = analytics.indicator_rows(received_query)
    concluded = analytics.indicator_rows(outputs_query)
    stock = analytics.indicator_rows(stock_query)

    inspections_received = [r for r in received if core._clean(r.get("Categoria")) == "Fiscalização"]
    inspections_concluded = [r for r in concluded if core._clean(r.get("Categoria")) == "Fiscalização"]
    inspections_stock = [r for r in stock if core._clean(r.get("Categoria")) == "Fiscalização"]

    public_projects = core.load_public_projects()
    public_project_statuses = [
        {"StatusOperacional": item["StatusAtual"]} for item in public_projects
    ]
    public_projects_concluded = [
        item for item in public_projects if core._clean(item.get("StatusAtual")).casefold() == "concluído".casefold()
    ]

    data["meta"]["taxonomy_version"] = "V07"
    data["meta"]["category_count"] = len({core._clean(r.get("Categoria")) for r in rows})

    data["charts"]["received_categories"] = base._top_categories(received)
    data["charts"]["concluded_categories"] = base._top_categories(concluded)
    data["charts"]["public_projects_status"] = base._top(public_project_statuses, "StatusOperacional", 8)

    data["management"]["inspections"] = {
        "protocols_received": len(inspections_received),
        "protocols_concluded_operational": len(inspections_concluded),
        "protocols_stock": len(inspections_stock),
        "note": "A categoria mede protocolos de fiscalização; não equivale ao total de vistorias/atos realizados."
    }
    data["management"]["public_projects"] = {
        "protocols_identified": len(public_projects),
        "protocols_received": 0,
        "protocols_concluded_operational": len(public_projects_concluded),
        "protocols_stock": len(public_projects) - len(public_projects_concluded),
        "reference_date": core.metadata().get("public_projects", {}).get("reference_dates", [None])[0],
        "note": "Carteira específica de projetos públicos da V04; os nomes, atividades, bloqueios, evidências e observações não entram no transporte público."
    }

    return data


def health():
    data = base.health()
    rows = base._rows()
    categories = {core._clean(r.get("Categoria")) for r in rows}
    metadata = core.metadata()
    semantic = metadata.get("semantic_memory", {})
    data["taxonomy_version"] = semantic.get("taxonomy_version", "V07")
    data["category_count"] = len(categories)
    data["taxonomy_ok"] = (
        len(rows) == int(metadata.get("source_rows", -1))
        and len(categories) == int(semantic.get("category_count", len(categories)))
    )
    return data
