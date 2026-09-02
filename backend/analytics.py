from __future__ import annotations

from collections import Counter
import csv
import io
from dataclasses import dataclass, replace
from datetime import date
from functools import lru_cache
from typing import Any, Iterable, Sequence

from backend import core


ANALYTICS_CONTRACT = "seplanbi-analytics-v1"
INDICATORS = {"received", "outputs", "stock"}
TERMINAL_STATUSES = {"Concluído", "Encerrado"}
INTERNAL_STATUSES = {"Em Análise", "Finalização Interna"}
SECTOR_UNAVAILABLE = "Não informado na fonte"

RESPONSIBILITY_BY_STATUS = {
    "Em Análise": "Fila Interna SEPLAN",
    "Finalização Interna": "Fila Interna SEPLAN",
    "Aguardando Responsável Externo": "Aguardando Responsável Externo",
    "Paralisado": "Paralisado",
    "Concluído": "Saída",
    "Encerrado": "Saída",
}

AGE_BANDS = (
    ("0–30 dias", 0, 30),
    ("31–60 dias", 31, 60),
    ("61–90 dias", 61, 90),
    ("91–180 dias", 91, 180),
    ("181+ dias", 181, None),
)

HIERARCHIES = {
    "received": ("year", "month", "macroprocess", "category", "protocol"),
    "outputs": ("year", "month", "macroprocess", "category", "output_type", "protocol"),
    "stock": ("responsibility", "macroprocess", "category", "status", "protocol"),
}

DEFAULT_GROUPS = {
    "received": ("year", "month", "macroprocess", "category", "sector"),
    "outputs": ("year", "month", "macroprocess", "category", "output_type", "sector"),
    "stock": ("responsibility", "macroprocess", "category", "sector", "status", "age_band"),
}

DIMENSION_LABELS = {
    "year": "Ano",
    "month": "Mês",
    "macroprocess": "Família de Processos",
    "category": "Categoria",
    "status": "Status",
    "sector": "Setor de tramitação",
    "responsibility": "Responsabilidade",
    "output_type": "Tipo de saída",
    "age_band": "Idade do estoque",
    "protocol": "Protocolos",
}

PUBLIC_DETAIL_FIELDS = (
    "protocol",
    "protocol_id",
    "opened",
    "last_movement",
    "macroprocess",
    "category",
    "status",
    "days_without_movement",
    "sector",
)

PRIVATE_DETAIL_FIELDS = (
    "ResponsavelInterno",
    "PessoaResponsavelExterna",
    "TipoPessoaResponsavel",
    "NomeRequerente",
    "ResponsavelTecnico",
    "ObservacaoUltimoTramite",
)


@dataclass(frozen=True)
class AnalyticsQuery:
    indicator: str
    start: date
    end: date
    period_explicit: bool = False
    years: tuple[int, ...] = ()
    months: tuple[int, ...] = ()
    macroprocesses: tuple[str, ...] = ()
    categories: tuple[str, ...] = ()
    statuses: tuple[str, ...] = ()
    sectors: tuple[str, ...] = ()
    responsibilities: tuple[str, ...] = ()
    output_types: tuple[str, ...] = ()
    age_bands: tuple[str, ...] = ()
    search: str = ""
    group_by: tuple[str, ...] = ()
    include_records: bool = False
    limit: int = 50
    offset: int = 0
    sort_by: str = "last_movement"
    sort_dir: str = "desc"


@dataclass(frozen=True)
class PrivateAuthorization:
    authenticated: bool
    can_view_pii: bool
    can_export_pii: bool = False


def _clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _split_values(value: str | None) -> tuple[str, ...]:
    return tuple(dict.fromkeys(item.strip() for item in _clean(value).split("|") if item.strip()))


def _split_ints(value: str | None, low: int, high: int) -> tuple[int, ...]:
    values: list[int] = []
    for item in _split_values(value):
        try:
            number = int(item)
        except ValueError:
            continue
        if low <= number <= high and number not in values:
            values.append(number)
    return tuple(values)


def _bounded_int(value: str | None, default: int, low: int, high: int) -> int:
    try:
        return max(low, min(high, int(value or default)))
    except (TypeError, ValueError):
        return default


def _normalized_indicator(value: str | None) -> str:
    aliases = {
        "recebidos": "received",
        "received": "received",
        "saidas": "outputs",
        "saídas": "outputs",
        "outputs": "outputs",
        "concluded": "outputs",
        "estoque": "stock",
        "stock": "stock",
    }
    return aliases.get(_clean(value).casefold(), "received")


def query_from_params(params: dict[str, str]) -> AnalyticsQuery:
    default_period = core.metadata()["default_period"]
    raw_start = core._as_date(params.get("from"))
    raw_end = core._as_date(params.get("to"))
    start = raw_start or date.fromisoformat(default_period["from"])
    end = raw_end or date.fromisoformat(default_period["to"])
    if end < start:
        start, end = end, start

    group_by = tuple(
        item for item in (_clean(value).casefold() for value in _clean(params.get("group_by")).split(","))
        if item in DIMENSION_LABELS and item != "protocol"
    )
    return AnalyticsQuery(
        indicator=_normalized_indicator(params.get("indicator")),
        start=start,
        end=end,
        period_explicit=raw_start is not None or raw_end is not None,
        years=_split_ints(params.get("year"), 2025, 2100),
        months=_split_ints(params.get("month"), 1, 12),
        macroprocesses=_split_values(params.get("macro")),
        categories=_split_values(params.get("category")),
        statuses=_split_values(params.get("status")),
        sectors=_split_values(params.get("sector")),
        responsibilities=_split_values(params.get("responsibility") or params.get("owner")),
        output_types=_split_values(params.get("output_type")),
        age_bands=_split_values(params.get("age_band")),
        search=_clean(params.get("q")).casefold(),
        group_by=group_by,
        include_records=_clean(params.get("include_records")).casefold() in {"1", "true", "sim"},
        limit=_bounded_int(params.get("limit"), 50, 1, 500),
        offset=_bounded_int(params.get("offset"), 0, 0, 10_000_000),
        sort_by=_clean(params.get("sort_by")) or "last_movement",
        sort_dir="asc" if _clean(params.get("sort_dir")).casefold() == "asc" else "desc",
    )


def query_from_dashboard(query: core.Query, indicator: str) -> AnalyticsQuery:
    responsibilities = ()
    if query.owner:
        legacy = {
            "Interno": "Fila Interna SEPLAN",
            "Externo": "Aguardando Responsável Externo",
            "Paralisado": "Paralisado",
        }
        responsibilities = (legacy.get(query.owner, query.owner),)
    return AnalyticsQuery(
        indicator=indicator,
        start=query.start,
        end=query.end,
        macroprocesses=(query.macro,) if query.macro else (),
        categories=_split_values(query.category),
        statuses=(query.status,) if query.status else (),
        sectors=(query.sector,) if query.sector else (),
        responsibilities=responsibilities,
        output_types=(query.output_type,) if query.output_type else (),
        years=(query.year,) if query.year else (),
        months=(query.month,) if query.month else (),
        search=query.search,
        limit=query.limit,
        offset=query.offset,
    )


def _age_band(days: int | None) -> str:
    if days is None or days < 0:
        return "Não calculável"
    for name, low, high in AGE_BANDS:
        if days >= low and (high is None or days <= high):
            return name
    return "Não calculável"


@lru_cache(maxsize=1)
def canonical_rows() -> tuple[dict[str, Any], ...]:
    reference = core._as_date(core.metadata().get("source_updated_at")) or date.today()
    result: list[dict[str, Any]] = []
    for source in core.load_rows():
        row = dict(source)
        opened = core._as_date(row.get("DataAbertura"))
        status = _clean(row.get("StatusOperacional"))
        stock_age = (reference - opened).days if opened and reference >= opened else None
        row["DataConclusaoOperacional"] = row.get("DataSaida") or ""
        row["ResponsabilidadeOperacional"] = RESPONSIBILITY_BY_STATUS.get(status, "Não classificada")
        row["SetorAnalitico"] = _clean(row.get("SetorAtual")) or SECTOR_UNAVAILABLE
        row["IdadeEstoqueDias"] = stock_age
        row["FaixaIdadeEstoque"] = _age_band(stock_age)
        result.append(row)
    return tuple(result)


def is_stock(row: dict[str, Any]) -> bool:
    return _clean(row.get("StatusOperacional")) not in TERMINAL_STATUSES


def is_output(row: dict[str, Any]) -> bool:
    return (
        _clean(row.get("StatusOperacional")) in TERMINAL_STATUSES
        and core._as_date(row.get("DataConclusaoOperacional")) is not None
    )


def _contains(values: tuple[str, ...], actual: Any) -> bool:
    return not values or _clean(actual) in values


def _matches_common(row: dict[str, Any], query: AnalyticsQuery) -> bool:
    if not _contains(query.macroprocesses, row.get("Macroprocesso")):
        return False
    if not _contains(query.categories, row.get("Categoria")):
        return False
    if not _contains(query.statuses, row.get("StatusOperacional")):
        return False
    if not _contains(query.sectors, row.get("SetorAnalitico")):
        return False
    if not _contains(query.responsibilities, row.get("ResponsabilidadeOperacional")):
        return False
    if query.output_types and not _contains(query.output_types, row.get("TipoSaida")):
        return False
    if query.age_bands and not _contains(query.age_bands, row.get("FaixaIdadeEstoque")):
        return False
    if query.search:
        normalized = query.search.replace("/", "-")
        protocol_parts = normalized.split("-")
        if len(protocol_parts) == 2 and all(part.isdigit() for part in protocol_parts):
            protocol_values = {
                _clean(row.get("ProtocoloID")).casefold(),
                _clean(row.get("NumeroAnoOriginal")).casefold().replace("/", "-"),
            }
            return normalized in protocol_values
        haystack = " | ".join(
            _clean(row.get(key)).casefold()
            for key in (
                "ProtocoloID", "NumeroAnoOriginal", "Macroprocesso", "Categoria",
                "StatusOperacional", "SetorAnalitico", "ResponsabilidadeOperacional",
            )
        )
        if query.search not in haystack:
            return False
    return True


def _event_date(row: dict[str, Any], indicator: str) -> date | None:
    if indicator == "received":
        return core._as_date(row.get("DataAbertura"))
    if indicator == "outputs":
        return core._as_date(row.get("DataConclusaoOperacional"))
    return core._as_date(row.get("DataAbertura"))


def apply_filters(
    rows: Iterable[dict[str, Any]], query: AnalyticsQuery, *, include_period: bool = True
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for row in rows:
        if not _matches_common(row, query):
            continue
        event_date = _event_date(row, query.indicator)
        if query.years and (event_date is None or event_date.year not in query.years):
            continue
        if query.months and (event_date is None or event_date.month not in query.months):
            continue
        # A fonte é um retrato do estoque na data de corte, não um histórico de
        # estados. Portanto, from/to só delimitam os eventos de entrada e saída;
        # aplicá-los ao estoque reconstruiria uma posição histórica inexistente.
        period_applies = include_period and query.indicator in {"received", "outputs"} and not query.years
        if period_applies and (event_date is None or not (query.start <= event_date <= query.end)):
            continue
        result.append(row)
    return result


def indicator_rows(query: AnalyticsQuery) -> list[dict[str, Any]]:
    rows = canonical_rows()
    if query.indicator == "stock":
        universe = (row for row in rows if is_stock(row))
    elif query.indicator == "outputs":
        universe = (row for row in rows if is_output(row))
    else:
        universe = iter(rows)
    return apply_filters(universe, query)


def dimension_value(row: dict[str, Any], dimension: str, indicator: str) -> str:
    event_date = _event_date(row, indicator)
    mapping = {
        "year": str(event_date.year) if event_date else "Não informado",
        "month": f"{event_date.year:04d}-{event_date.month:02d}" if event_date else "Não informado",
        "macroprocess": _clean(row.get("Macroprocesso")) or "Não informado",
        "category": _clean(row.get("Categoria")) or "Não informado",
        "status": _clean(row.get("StatusOperacional")) or "Não informado",
        "sector": _clean(row.get("SetorAnalitico")) or SECTOR_UNAVAILABLE,
        "responsibility": _clean(row.get("ResponsabilidadeOperacional")) or "Não classificada",
        "output_type": _clean(row.get("TipoSaida")) or "Não se aplica",
        "age_band": _clean(row.get("FaixaIdadeEstoque")) or "Não calculável",
        "protocol": _clean(row.get("NumeroAnoOriginal")) or _clean(row.get("ProtocoloID")),
    }
    return mapping[dimension]


def group_rows(
    rows: Sequence[dict[str, Any]], dimensions: Sequence[str], indicator: str
) -> list[dict[str, Any]]:
    dimensions = tuple(dimension for dimension in dimensions if dimension in DIMENSION_LABELS)
    if not dimensions:
        return [{"keys": {}, "value": len(rows)}]
    counts: Counter[tuple[str, ...]] = Counter(
        tuple(dimension_value(row, dimension, indicator) for dimension in dimensions)
        for row in rows
    )
    groups = [
        {
            "keys": dict(zip(dimensions, key)),
            "value": value,
            "drill": [{"dimension": dimension, "value": item} for dimension, item in zip(dimensions, key)],
        }
        for key, value in counts.items()
    ]
    return sorted(groups, key=lambda item: (-item["value"], tuple(item["keys"].values())))


def _shift_previous_year(value: date) -> date:
    try:
        return value.replace(year=value.year - 1)
    except ValueError:
        return value.replace(year=value.year - 1, day=28)


def indicator_comparison(query: AnalyticsQuery, indicator: str) -> dict[str, Any]:
    common = replace(query, indicator=indicator, years=(), period_explicit=True)
    current = indicator_rows(common)
    previous_query = replace(
        common,
        start=_shift_previous_year(common.start),
        end=_shift_previous_year(common.end),
    )
    previous = indicator_rows(previous_query)
    change = round((len(current) - len(previous)) / len(previous) * 100, 1) if previous else None
    current_months = Counter(
        _event_date(row, indicator).month for row in current if _event_date(row, indicator)
    )
    previous_months = Counter(
        _event_date(row, indicator).month for row in previous if _event_date(row, indicator)
    )
    return {
        "current": {"from": common.start.isoformat(), "to": common.end.isoformat(), "value": len(current)},
        "previous": {
            "from": previous_query.start.isoformat(),
            "to": previous_query.end.isoformat(),
            "value": len(previous),
        },
        "change_percent": change,
        "absolute_change": len(current) - len(previous),
        "monthly": [
            {"month": month, "current": current_months[month], "previous": previous_months[month]}
            for month in sorted(set(current_months) | set(previous_months))
        ],
        "rule": "Mesmo intervalo de datas deslocado em um ano; nunca compara ano parcial com ano anterior completo.",
    }


def received_comparison(query: AnalyticsQuery) -> dict[str, Any]:
    return indicator_comparison(query, "received")


def monthly_flow(query: AnalyticsQuery) -> list[dict[str, Any]]:
    received = indicator_rows(replace(query, indicator="received", output_types=(), age_bands=()))
    outputs = indicator_rows(replace(query, indicator="outputs"))
    received_counts = Counter(
        _event_date(row, "received").isoformat()[:7]
        for row in received
        if _event_date(row, "received")
    )
    output_counts = Counter(
        _event_date(row, "outputs").isoformat()[:7]
        for row in outputs
        if _event_date(row, "outputs")
    )
    months = sorted(set(received_counts) | set(output_counts))
    return [
        {
            "month": month,
            "received": received_counts[month],
            "outputs": output_counts[month],
            "balance": received_counts[month] - output_counts[month],
        }
        for month in months
    ]


def control_totals(query: AnalyticsQuery) -> dict[str, Any]:
    received = indicator_rows(replace(query, indicator="received", output_types=(), age_bands=()))
    outputs = indicator_rows(replace(query, indicator="outputs", age_bands=()))
    stock_query = replace(query, indicator="stock", period_explicit=False, years=(), months=(), output_types=())
    stock = indicator_rows(stock_query)
    concluded = sum(1 for row in outputs if _clean(row.get("TipoSaida")) == "Concluído")
    closed = sum(1 for row in outputs if _clean(row.get("TipoSaida")) == "Encerrado")
    internal = sum(1 for row in stock if row["ResponsabilidadeOperacional"] == "Fila Interna SEPLAN")
    external = sum(1 for row in stock if row["ResponsabilidadeOperacional"] == "Aguardando Responsável Externo")
    paralyzed = sum(1 for row in stock if row["ResponsabilidadeOperacional"] == "Paralisado")
    return {
        "received": len(received),
        "outputs": len(outputs),
        "concluded": concluded,
        "closed": closed,
        "period_balance": len(received) - len(outputs),
        "stock": len(stock),
        "internal": internal,
        "external": external,
        "paralyzed": paralyzed,
        "equations": {
            "outputs_equals_concluded_plus_closed": len(outputs) == concluded + closed,
            "stock_equals_internal_plus_external_plus_paralyzed": len(stock) == internal + external + paralyzed,
        },
        "depends_on_seplan_percent": round(internal / len(stock) * 100, 1) if stock else None,
    }


def _active_filters(query: AnalyticsQuery) -> list[dict[str, str]]:
    active: list[dict[str, str]] = []
    if query.period_explicit or query.indicator in {"received", "outputs"}:
        active.append({"dimension": "period", "label": "Período", "value": f"{query.start.isoformat()} a {query.end.isoformat()}"})
    for dimension, label, values in (
        ("year", "Ano", query.years),
        ("month", "Mês", query.months),
        ("macroprocess", "Família de Processos", query.macroprocesses),
        ("category", "Categoria", query.categories),
        ("status", "Status", query.statuses),
        ("sector", "Setor de tramitação", query.sectors),
        ("responsibility", "Responsabilidade", query.responsibilities),
        ("output_type", "Tipo de saída", query.output_types),
        ("age_band", "Idade do estoque", query.age_bands),
    ):
        if values:
            active.append({"dimension": dimension, "label": label, "value": " | ".join(map(str, values))})
    if query.search:
        active.append({"dimension": "search", "label": "Pesquisa", "value": query.search})
    return active


def breadcrumb(query: AnalyticsQuery) -> list[dict[str, str]]:
    return [
        {"label": "Indicador", "value": {"received": "Recebidos", "outputs": "Saídas", "stock": "Estoque"}[query.indicator]},
        *({"label": item["label"], "value": item["value"]} for item in _active_filters(query)),
    ]


def _public_record(row: dict[str, Any]) -> dict[str, Any]:
    days = row.get("DiasSemMovimento")
    return {
        "protocol": row.get("NumeroAnoOriginal") or row.get("ProtocoloID"),
        "protocol_id": row.get("ProtocoloID"),
        "opened": row.get("DataAbertura"),
        "last_movement": row.get("UltimoTramiteDataHora"),
        "macroprocess": row.get("Macroprocesso"),
        "category": row.get("Categoria"),
        "status": row.get("StatusOperacional"),
        "days_without_movement": days if isinstance(days, int) and days >= 0 else None,
        "sector": row.get("SetorAnalitico"),
    }


def drilldown_public(query: AnalyticsQuery) -> dict[str, Any]:
    rows = indicator_rows(query)
    sort_fields = {
        "protocol": "NumeroAnoOriginal",
        "opened": "DataAbertura",
        "last_movement": "UltimoTramiteDataHora",
        "macroprocess": "Família de Processos",
        "category": "Categoria",
        "status": "StatusOperacional",
        "days_without_movement": "DiasSemMovimento",
        "sector": "Setor de tramitação",
    }
    field = sort_fields.get(query.sort_by, "UltimoTramiteDataHora")

    def sort_key(row: dict[str, Any]) -> tuple[Any, str]:
        value = row.get(field)
        if field == "DiasSemMovimento":
            try:
                primary: Any = int(value)
            except (TypeError, ValueError):
                primary = -1
        else:
            primary = _clean(value).casefold()
        return primary, _clean(row.get("ProtocoloID"))

    ordered = sorted(rows, key=sort_key, reverse=query.sort_dir == "desc")
    page = ordered[query.offset : query.offset + query.limit]
    return {
        "total": len(ordered),
        "offset": query.offset,
        "limit": query.limit,
        "sort_by": query.sort_by,
        "sort_dir": query.sort_dir,
        "items": [_public_record(row) for row in page],
        "fields": list(PUBLIC_DETAIL_FIELDS),
    }


def drilldown_private(query: AnalyticsQuery, authorization: PrivateAuthorization) -> dict[str, Any]:
    if not authorization.authenticated or not authorization.can_view_pii:
        raise PermissionError("Acesso privado negado: autenticação e autorização de PII são obrigatórias.")
    from backend.private_data import load_private_rows

    private_by_id = load_private_rows()

    # O universo público pode receber um incremento sanitizado antes da camada
    # privada correspondente. A área autorizada nunca pode combinar detalhes
    # pessoais com um protocolo sem par validado, nem ficar indisponível por um
    # único registro ainda pendente de reconciliação. Por isso a paginação é
    # calculada após a interseção, com a divergência explicitamente informada.
    public_total = len(indicator_rows(query))
    public_all = drilldown_public(replace(query, offset=0, limit=max(1, public_total)))
    reconciled: list[dict[str, Any]] = []
    unreconciled = 0
    for public in public_all["items"]:
        private = private_by_id.get(_clean(public.get("protocol_id")))
        if private is None:
            unreconciled += 1
            continue
        reconciled.append({**public, **{field: private.get(field, "") for field in PRIVATE_DETAIL_FIELDS}})

    page = reconciled[query.offset : query.offset + query.limit]
    return {
        "total": len(reconciled),
        "offset": query.offset,
        "limit": query.limit,
        "sort_by": query.sort_by,
        "sort_dir": query.sort_dir,
        "items": page,
        "fields": [*PUBLIC_DETAIL_FIELDS, *PRIVATE_DETAIL_FIELDS],
        "export_allowed": authorization.can_export_pii,
        "reconciliation": {
            "status": "partial" if unreconciled else "complete",
            "excluded_public_records": unreconciled,
        },
    }


def export_public_csv(query: AnalyticsQuery) -> str:
    """Exporta somente a allowlist pública; nunca carrega a camada privada."""
    total = len(indicator_rows(query))
    page = drilldown_public(replace(query, offset=0, limit=max(1, total)))
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=list(PUBLIC_DETAIL_FIELDS), extrasaction="ignore")
    writer.writeheader()
    writer.writerows(page["items"])
    return stream.getvalue()


def private_stock_by_internal_responsible(
    query: AnalyticsQuery, authorization: PrivateAuthorization
) -> list[dict[str, Any]]:
    if not authorization.authenticated or not authorization.can_view_pii:
        raise PermissionError("Acesso privado negado: autenticação e autorização de PII são obrigatórias.")
    from backend.private_data import load_private_rows

    private_by_id = load_private_rows()
    stock_query = replace(query, indicator="stock")
    counts = Counter(
        _clean(private_by_id[row["ProtocoloID"]].get("ResponsavelInterno")) or "Não informado"
        for row in indicator_rows(stock_query)
    )
    return [{"name": name, "value": value} for name, value in counts.most_common()]


def analytics_response(query: AnalyticsQuery) -> dict[str, Any]:
    rows = indicator_rows(query)
    dimensions = query.group_by or (HIERARCHIES[query.indicator][0],)
    groups = group_rows(rows, dimensions, query.indicator)
    grouped_sum = sum(item["value"] for item in groups)
    response: dict[str, Any] = {
        "ok": True,
        "contract": ANALYTICS_CONTRACT,
        "meta": {
            "dataset": core.metadata().get("dataset"),
            "schema_version": core.metadata().get("schema_version"),
            "source_updated_at": core.metadata().get("source_updated_at"),
            "indicator": query.indicator,
            "total": len(rows),
            "grouped_sum": grouped_sum,
            "grouping_reconciled": grouped_sum == len(rows),
            "sector_coverage": {
                "complete_for_current_stock": True,
                "historical_received_outputs": "Não informado na V06/V04",
            },
        },
        "filters": {
            "active": _active_filters(query),
            "clear_action": {"label": "Limpar filtros", "query": {}},
            "separator": "|",
        },
        "breadcrumb": breadcrumb(query),
        "hierarchy": [
            {"dimension": dimension, "label": DIMENSION_LABELS[dimension]}
            for dimension in HIERARCHIES[query.indicator]
        ],
        "groups": groups,
        "totals": control_totals(query),
        "permissions": {
            "public_detail": True,
            "private_detail": False,
            "public_export": True,
            "private_export": False,
            "note": "A rota pública retorna somente a allowlist sanitizada; PII exige backend autenticado e autorizado ainda inexistente no deployment atual.",
        },
        "options": {
            "years": sorted({core._as_date(row.get("DataAbertura")).year for row in canonical_rows() if core._as_date(row.get("DataAbertura"))}),
            "months": list(range(1, 13)),
            "macroprocesses": sorted({_clean(row.get("Macroprocesso")) for row in canonical_rows()}, key=str.casefold),
            "categories": sorted({_clean(row.get("Categoria")) for row in canonical_rows()}, key=str.casefold),
            "statuses": sorted({_clean(row.get("StatusOperacional")) for row in canonical_rows()}, key=str.casefold),
            "sectors": sorted({_clean(row.get("SetorAnalitico")) for row in canonical_rows()}, key=str.casefold),
            "responsibilities": ["Fila Interna SEPLAN", "Aguardando Responsável Externo", "Paralisado"],
            "output_types": ["Concluído", "Encerrado"],
            "age_bands": [item[0] for item in AGE_BANDS],
        },
        "available_groups": list(DEFAULT_GROUPS[query.indicator]),
    }
    if query.indicator in {"received", "outputs"}:
        response["comparison"] = indicator_comparison(query, query.indicator)
    if query.indicator == "outputs":
        response["monthly_flow"] = monthly_flow(query)
    if query.include_records:
        response["records"] = drilldown_public(query)
    return response


__all__ = [
    "ANALYTICS_CONTRACT",
    "AGE_BANDS",
    "AnalyticsQuery",
    "HIERARCHIES",
    "PrivateAuthorization",
    "analytics_response",
    "apply_filters",
    "canonical_rows",
    "control_totals",
    "drilldown_private",
    "drilldown_public",
    "export_public_csv",
    "group_rows",
    "indicator_rows",
    "indicator_comparison",
    "monthly_flow",
    "private_stock_by_internal_responsible",
    "query_from_dashboard",
    "query_from_params",
    "received_comparison",
]
