from __future__ import annotations

from backend import core
from backend import analytics
from backend import delivery_core as base

query_from_params = base.query_from_params


INDICATOR_COVERAGE_V2 = [
    {"id":"KPI01","name":"Processos recebidos","status":"DISPONÍVEL","reason":"Data de abertura e protocolo."},
    {"id":"KPI02","name":"Processos concluídos","status":"DISPONÍVEL","reason":"Conclusão operacional e encerramento formal permanecem separados."},
    {"id":"KPI03","name":"Estoque pendente","status":"DISPONÍVEL","reason":"Status atual separado por responsabilidade operacional."},
    {"id":"KPI04","name":"Tempo de tramitação","status":"DISPONÍVEL","reason":"Mediana, média e P90 sobre saídas operacionais, com drill-down."},
    {"id":"KPI05","name":"% parados > X dias","status":"DISPONÍVEL","reason":"Calculado exclusivamente sobre a fila interna SEPLAN."},
    {"id":"KPI06","name":"% concluído dentro do prazo","status":"NÃO HOMOLOGADO","reason":"Falta regra oficial de SLA/prazo por categoria e tratamento de suspensões."},
    {"id":"KPI07","name":"Diligências por processo","status":"PARCIAL","reason":"Eventos incrementais disponíveis; a fonte não representa o histórico integral de tramitação."},
    {"id":"KPI08","name":"Fiscalizações realizadas","status":"NÃO HOMOLOGADO","reason":"Protocolos de fiscalização não comprovam, sozinhos, a realização do ato ou vistoria."},
    {"id":"KPI09","name":"Denúncias recebidas/respondidas","status":"DISPONÍVEL","reason":"Categoria Denúncia permite medir entradas, saídas, estoque e tempo de resposta operacional."},
    {"id":"KPI10","name":"Projetos públicos por etapa","status":"DISPONÍVEL","reason":"Carteira complementar específica de 20 projetos com referência em 27/08/2026."},
    {"id":"KPI11","name":"Pendências por responsável/setor","status":"DISPONÍVEL","reason":"Responsabilidade, setor, categoria e status podem ser cruzados sem exposição de dados pessoais."},
]


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
    data["indicator_coverage"] = INDICATOR_COVERAGE_V2

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
