import { useEffect, useMemo, useState } from "react";
import { fetchAnalytics } from "../api";
import { activeDashboardFilters, publicAnalyticsExportUrl, type AnalyticsIndicator, type AnalyticsRequest, type AnalyticsResponse } from "../analytics";
import { useDashboardContent } from "../content/DashboardContentContext";
import { formatNumber, formatPercent } from "../format";
import type { DashboardFilters } from "../types";
import { BiDrillTable } from "./BiDrillTable";
import { BalanceEvolution, InteractiveBars, MetricTile, MonthComparison, MonthlyFlow, StackedComposition, type VisualItem } from "./BiVisuals";

interface BiPanelProps {
  indicator: AnalyticsIndicator;
  filters: DashboardFilters;
  onFilters: (filters: DashboardFilters) => void;
}

interface PanelData {
  summary: AnalyticsResponse;
  macro: AnalyticsResponse;
  category: AnalyticsResponse;
  secondary: AnalyticsResponse;
  detail: AnalyticsResponse;
  concentration?: AnalyticsResponse;
  status?: AnalyticsResponse;
}

const RESPONSIBILITY_TO_QUERY: Record<string, string> = {
  Interno: "Fila Interna SEPLAN",
  Externo: "Aguardando Responsável Externo",
  Paralisado: "Paralisado",
};

const QUERY_TO_OWNER: Record<string, string> = {
  "Fila Interna SEPLAN": "Interno",
  "Aguardando Responsável Externo": "Externo",
  Paralisado: "Paralisado",
};

const SEMANTIC_COLORS: Record<string, Record<string, string>> = {
  responsibility: {
    "Fila Interna SEPLAN": "var(--blue)",
    "Aguardando Responsável Externo": "var(--slate)",
    Paralisado: "var(--red)",
  },
  output_type: {
    Concluído: "var(--green)",
    Encerrado: "var(--slate)",
  },
  status: {
    "Em Análise": "var(--blue)",
    "Finalização Interna": "var(--teal)",
    "Aguardando Responsável Externo": "var(--slate)",
    Paralisado: "var(--red)",
    Concluído: "var(--green)",
    Encerrado: "var(--slate)",
  },
  age_band: {
    "0–30 dias": "var(--green)",
    "31–60 dias": "var(--teal)",
    "61–90 dias": "#ba8a17",
    "91–180 dias": "var(--orange)",
    "181+ dias": "var(--red)",
  },
};

function items(response: AnalyticsResponse | undefined, dimension: string): VisualItem[] {
  return (response?.groups ?? []).map((group) => {
    const key = group.keys[dimension] ?? Object.values(group.keys)[0] ?? "Não informado";
    return { key, label: key, value: group.value, color: SEMANTIC_COLORS[dimension]?.[key] };
  });
}

export function BiPanel({ indicator, filters, onFilters }: BiPanelProps) {
  const { copy } = useDashboardContent();
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState("last_movement");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [stockDimension, setStockDimension] = useState<"macroprocess" | "category" | "sector">("macroprocess");

  const baseRequest = useMemo<AnalyticsRequest>(() => ({
    indicator,
    from: filters.year ? undefined : filters.from,
    to: filters.year ? undefined : filters.to,
    year: filters.year ? [filters.year] : undefined,
    month: filters.month ? [Number(filters.month)] : undefined,
    macro: filters.macro ? [filters.macro] : undefined,
    category: filters.category ? [filters.category] : undefined,
    status: filters.status ? [filters.status] : undefined,
    sector: filters.sector ? [filters.sector] : undefined,
    responsibility: filters.owner ? [RESPONSIBILITY_TO_QUERY[filters.owner] ?? filters.owner] : undefined,
    outputType: filters.outputType ? [filters.outputType as "Concluído" | "Encerrado"] : undefined,
    ageBand: filters.ageBand ? [filters.ageBand] : undefined,
    search: filters.q,
  }), [filters, indicator]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const detailRequest: AnalyticsRequest = {
      ...baseRequest,
      includeRecords: true,
      offset,
      limit: 25,
      sortBy,
      sortDir,
    };
    const summaryGroup = indicator === "received" ? ["month"] : indicator === "outputs" ? ["output_type"] : ["responsibility"];
    const secondaryGroup = indicator === "received" ? ["month"] : indicator === "outputs" ? ["output_type"] : ["age_band"];
    const categoryRequest: AnalyticsRequest = indicator === "stock" && !filters.owner
      ? { ...baseRequest, responsibility: ["Fila Interna SEPLAN"], groupBy: ["category"] }
      : { ...baseRequest, groupBy: ["category"] };
    const requests = [
      fetchAnalytics({ ...baseRequest, groupBy: summaryGroup }, controller.signal),
      fetchAnalytics({ ...baseRequest, groupBy: ["macroprocess"] }, controller.signal),
      fetchAnalytics(categoryRequest, controller.signal),
      fetchAnalytics({ ...baseRequest, groupBy: secondaryGroup }, controller.signal),
      fetchAnalytics(detailRequest, controller.signal),
    ];
    if (indicator === "stock") {
      requests.push(fetchAnalytics({ ...baseRequest, groupBy: [stockDimension] }, controller.signal));
      requests.push(fetchAnalytics({ ...baseRequest, groupBy: ["status"] }, controller.signal));
    }
    Promise.all(requests)
      .then(([summary, macro, category, secondary, detail, concentration, status]) => setData({ summary, macro, category, secondary, detail, concentration, status }))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Falha ao consultar a camada analítica.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [baseRequest, filters.owner, indicator, offset, sortBy, sortDir, stockDimension]);

  useEffect(() => setOffset(0), [filters, indicator]);

  const apply = (patch: Partial<DashboardFilters>) => onFilters({ ...filters, ...patch, offset: 0 });
  const toggle = (field: keyof DashboardFilters, value: string) => apply({ [field]: filters[field] === value ? "" : value } as Partial<DashboardFilters>);
  const selectResponsibility = (value: string) => toggle("owner", QUERY_TO_OWNER[value] ?? value);
  const selectCategoryFromStockPriority = (value: string) => apply({ category: filters.category === value ? "" : value, owner: filters.owner || "Interno" });
  const clearSelection = () => apply({ month: "", macro: "", category: "", status: "", owner: "", sector: "", outputType: "", ageBand: "", q: "" });
  const drillUp = () => {
    const order = indicator === "received"
      ? ["category", "macro", "month"]
      : indicator === "outputs"
        ? ["outputType", "category", "month"]
        : ["status", "category", "ageBand", "owner"];
    const field = order.find((key) => Boolean(filters[key as keyof DashboardFilters]));
    if (field) apply({ [field]: "" } as Partial<DashboardFilters>);
  };

  const pageCopy = indicator === "received" ? copy.received : indicator === "outputs" ? copy.outputs : copy.stock;
  const active = activeDashboardFilters(filters);
  const detail = data?.detail.records;
  const exportHref = publicAnalyticsExportUrl(baseRequest);
  const currentYear = data?.summary.comparison?.current.from.slice(0, 4) ?? filters.from.slice(0, 4) ?? "2026";
  const previousYear = data?.summary.comparison?.previous.from.slice(0, 4) ?? "2025";

  return (
    <section className="bi-page" data-panel={indicator}>
      <nav className="drill-breadcrumb" aria-label="Caminho do drill-down">
        <span>{copy.common.breadcrumbOverview}</span><span>{pageCopy.title}</span>
        {active.map((item) => <span key={item.key}>{item.label}: {item.value}</span>)}
      </nav>
      <header className="page-hero bi-hero">
        <div><span className="eyebrow">{pageCopy.eyebrow}</span><h1>{pageCopy.title}</h1><p>{pageCopy.description}</p></div>
        <div className="bi-page-actions"><button className="ghost-button" onClick={drillUp} disabled={!active.some((item) => item.key !== "period")}>Drill-up</button><button className="ghost-button" onClick={clearSelection}>Limpar seleção</button></div>
      </header>

      {error ? <div className="error-panel" role="alert"><div><span>Falha analítica</span><strong>Não foi possível montar este painel.</strong><p>{error}</p></div></div> : null}
      {loading && !data ? <div className="loading-screen"><span className="loading-mark" /><div><strong>Consultando a camada analítica</strong><p>Aplicando filtros e reconciliando os grupos…</p></div></div> : null}
      {data ? (
        <>
          {indicator === "received" ? (
            <>
              <section className="bi-metric-grid four">
                <MetricTile label={copy.received.metrics.current} value={formatNumber(data.summary.comparison?.current.value)} detail={`${data.summary.comparison?.current.from} a ${data.summary.comparison?.current.to}`} />
                <MetricTile label={`${copy.received.metrics.previous} ${previousYear}`} value={formatNumber(data.summary.comparison?.previous.value)} detail={copy.received.metrics.previousDetail} tone="slate" />
                <MetricTile label={copy.received.metrics.absolute} value={`${(data.summary.comparison?.absolute_change ?? 0) > 0 ? "+" : ""}${formatNumber(data.summary.comparison?.absolute_change)}`} detail={copy.received.metrics.absoluteDetail} tone={(data.summary.comparison?.absolute_change ?? 0) > 0 ? "orange" : "green"} />
                <MetricTile label={copy.received.metrics.percent} value={formatPercent(data.summary.comparison?.change_percent)} detail={copy.received.metrics.percentDetail} tone={(data.summary.comparison?.absolute_change ?? 0) > 0 ? "orange" : "green"} />
              </section>
              <section className="bi-layout-main">
                <article className="panel bi-primary-chart"><div className="panel-heading"><div><span className="eyebrow">{copy.received.monthly.eyebrow}</span><h2>{copy.received.monthly.title}</h2><p>{copy.received.monthly.description}</p></div><span className="panel-chip">{currentYear} × {previousYear}</span></div>
                  <MonthComparison data={data.summary.comparison?.monthly ?? []} currentYear={currentYear} previousYear={previousYear} selectedMonth={filters.month} onSelect={(month) => toggle("month", String(month))} />
                </article>
                <article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.received.macro.eyebrow}</span><h2>{copy.received.macro.title}</h2><p>{copy.received.macro.description}</p></div></div><InteractiveBars items={items(data.macro, "macroprocess")} selected={filters.macro} onSelect={(item) => toggle("macro", item.key)} /></article>
              </section>
              <section className="bi-layout-secondary"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.received.category.eyebrow}</span><h2>{copy.received.category.title}</h2><p>{copy.received.category.description}</p></div></div><InteractiveBars items={items(data.category, "category")} selected={filters.category} onSelect={(item) => toggle("category", item.key)} tone="teal" initialLimit={10} /></article><article className="panel bi-reading"><span className="eyebrow">{copy.received.reading.eyebrow}</span><h2>{formatNumber(data.summary.meta.total)} {copy.received.reading.titleSuffix}</h2><p>A soma das categorias é {formatNumber(data.category.meta.grouped_sum)} e a reconciliação está {data.category.meta.grouping_reconciled ? copy.received.reading.reconciled : copy.received.reading.divergent}.</p><strong>{data.summary.comparison?.rule}</strong></article></section>
            </>
          ) : null}

          {indicator === "outputs" ? (
            <>
              <section className="bi-metric-grid five">
                <MetricTile label={copy.outputs.metrics.total} value={formatNumber(data.summary.totals.outputs)} />
                <MetricTile label={copy.outputs.metrics.concluded} value={formatNumber(data.summary.totals.concluded)} tone="green" />
                <MetricTile label={copy.outputs.metrics.closed} value={formatNumber(data.summary.totals.closed)} tone="slate" />
                <MetricTile label={copy.outputs.metrics.balance} value={`${data.summary.totals.period_balance > 0 ? "+" : ""}${formatNumber(data.summary.totals.period_balance)}`} detail={data.summary.totals.period_balance > 0 ? copy.outputs.metrics.balancePositive : copy.outputs.metrics.balanceNegative} tone={data.summary.totals.period_balance > 0 ? "orange" : "green"} />
                <MetricTile label={`${copy.outputs.metrics.previous} ${previousYear}`} value={formatNumber(data.summary.comparison?.previous.value)} detail={`${formatPercent(data.summary.comparison?.change_percent)} no período homólogo`} />
              </section>
              <section className="bi-layout-main"><article className="panel bi-primary-chart"><div className="panel-heading"><div><span className="eyebrow">{copy.outputs.flow.eyebrow}</span><h2>{copy.outputs.flow.title}</h2><p>{copy.outputs.flow.description}</p></div></div><MonthlyFlow data={data.summary.monthly_flow ?? []} selectedMonth={filters.month} onSelect={(month) => toggle("month", String(month))} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.outputs.composition.eyebrow}</span><h2>{copy.outputs.composition.title}</h2><p>{copy.outputs.composition.description}</p></div></div><InteractiveBars items={items(data.secondary, "output_type")} selected={filters.outputType} onSelect={(item) => toggle("outputType", item.key)} tone="green" /></article></section>
              <section className="bi-layout-secondary"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.outputs.category.eyebrow}</span><h2>{copy.outputs.category.title}</h2><p>{copy.outputs.category.description}</p></div></div><InteractiveBars items={items(data.category, "category")} selected={filters.category} onSelect={(item) => toggle("category", item.key)} tone="teal" initialLimit={10} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.outputs.balanceEvolution.eyebrow}</span><h2>{copy.outputs.balanceEvolution.title}</h2><p>{copy.outputs.balanceEvolution.description}</p></div></div><BalanceEvolution data={data.summary.monthly_flow ?? []} selectedMonth={filters.month} onSelect={(month) => toggle("month", String(month))} /></article></section>
            </>
          ) : null}

          {indicator === "stock" ? (
            <>
              <section className="bi-metric-grid five"><MetricTile label={copy.stock.metrics.total} value={formatNumber(data.summary.totals.stock)} /><MetricTile label={copy.stock.metrics.internal} value={formatNumber(data.summary.totals.internal)} tone="blue" /><MetricTile label={copy.stock.metrics.external} value={formatNumber(data.summary.totals.external)} tone="slate" /><MetricTile label={copy.stock.metrics.paralyzed} value={formatNumber(data.summary.totals.paralyzed)} tone="red" /><MetricTile label={copy.stock.metrics.depends} value={formatPercent(data.summary.totals.depends_on_seplan_percent)} detail={copy.stock.metrics.dependsDetail} tone="teal" /></section>
              <section className="bi-layout-main"><article className="panel bi-primary-chart"><div className="panel-heading"><div><span className="eyebrow">{copy.stock.composition.eyebrow}</span><h2>{copy.stock.composition.title}</h2><p>{copy.stock.composition.description}</p></div></div><StackedComposition items={items(data.summary, "responsibility")} selected={filters.owner ? RESPONSIBILITY_TO_QUERY[filters.owner] : ""} onSelect={(item) => selectResponsibility(item.key)} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.stock.age.eyebrow}</span><h2>{copy.stock.age.title}</h2><p>{copy.stock.age.description}</p></div></div><InteractiveBars items={items(data.secondary, "age_band")} selected={filters.ageBand} onSelect={(item) => toggle("ageBand", item.key)} tone="orange" /></article></section>
              <section className="bi-layout-secondary"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.stock.gargles.eyebrow}</span><h2>{copy.stock.gargles.title}</h2><p>{filters.owner ? copy.stock.gargles.selectedDescription : copy.stock.gargles.defaultDescription}</p></div></div><InteractiveBars items={items(data.category, "category")} selected={filters.category} onSelect={(item) => selectCategoryFromStockPriority(item.key)} tone="red" initialLimit={10} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.stock.concentration.eyebrow}</span><h2>{copy.stock.concentration.title}</h2><p>{copy.stock.concentration.description}</p></div><div className="dimension-switch"><button className={stockDimension === "macroprocess" ? "active" : ""} onClick={() => setStockDimension("macroprocess")}>Família de Processos</button><button className={stockDimension === "category" ? "active" : ""} onClick={() => setStockDimension("category")}>Categoria</button><button className={stockDimension === "sector" ? "active" : ""} onClick={() => setStockDimension("sector")}>Setor de tramitação</button><button disabled title="Exige autenticação e autorização para PII">Responsável 🔒</button></div></div><InteractiveBars items={items(data.concentration, stockDimension)} selected={filters[stockDimension === "macroprocess" ? "macro" : stockDimension]} onSelect={(item) => toggle(stockDimension === "macroprocess" ? "macro" : stockDimension, item.key)} tone="teal" initialLimit={8} /></article></section>
              <section className="panel bi-status-level"><div className="panel-heading"><div><span className="eyebrow">{copy.stock.status.eyebrow}</span><h2>{filters.category ? `${copy.stock.status.titlePrefix} ${filters.category}` : copy.stock.status.titleDefault}</h2><p>{copy.stock.status.description}</p></div><span className="panel-chip">{copy.stock.status.chip}</span></div><InteractiveBars items={items(data.status, "status")} selected={filters.status} onSelect={(item) => toggle("status", item.key)} tone="blue" initialLimit={6} /></section>
            </>
          ) : null}

          {detail ? <BiDrillTable total={detail.total} items={detail.items} offset={detail.offset} limit={detail.limit} sortBy={sortBy} sortDir={sortDir} onPage={setOffset} onSort={(field) => { setOffset(0); if (sortBy === field) setSortDir((value) => value === "asc" ? "desc" : "asc"); else { setSortBy(field); setSortDir("asc"); } }} onProtocol={(protocol) => apply({ q: protocol })} exportHref={exportHref} exportAllowed={data.detail.permissions.public_export} /> : null}
        </>
      ) : null}
      {loading && data ? <div className="refresh-strip" aria-label="Recalculando painel"><i /></div> : null}
    </section>
  );
}
