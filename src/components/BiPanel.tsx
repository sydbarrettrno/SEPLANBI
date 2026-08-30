import { useEffect, useMemo, useState } from "react";
import { fetchAnalytics } from "../api";
import { activeDashboardFilters, publicAnalyticsExportUrl, type AnalyticsIndicator, type AnalyticsRequest, type AnalyticsResponse } from "../analytics";
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

function pageCopy(indicator: AnalyticsIndicator) {
  if (indicator === "received") return { eyebrow: "PAINEL 1 · DEMANDA", title: "Processos recebidos", description: "Compare períodos equivalentes e investigue mês, macroprocesso, categoria e protocolo." };
  if (indicator === "outputs") return { eyebrow: "PAINEL 2 · PRODUÇÃO", title: "Saídas e saldo", description: "Separe Concluído de Encerrado e confronte a produção com o volume recebido." };
  return { eyebrow: "PAINEL 3 · POSIÇÃO ATUAL", title: "Estoque e concentração operacional", description: "Identifique responsabilidade, idade e gargalos sem transformar concentração em ranking punitivo." };
}

export function BiPanel({ indicator, filters, onFilters }: BiPanelProps) {
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

  const copy = pageCopy(indicator);
  const active = activeDashboardFilters(filters);
  const detail = data?.detail.records;
  const exportHref = publicAnalyticsExportUrl(baseRequest);
  const currentYear = data?.summary.comparison?.current.from.slice(0, 4) ?? filters.from.slice(0, 4) ?? "2026";
  const previousYear = data?.summary.comparison?.previous.from.slice(0, 4) ?? "2025";

  return (
    <section className="bi-page" data-panel={indicator}>
      <nav className="drill-breadcrumb" aria-label="Caminho do drill-down">
        <span>Visão executiva</span><span>{copy.title}</span>
        {active.map((item) => <span key={item.key}>{item.label}: {item.value}</span>)}
      </nav>
      <header className="page-hero bi-hero">
        <div><span className="eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.description}</p></div>
        <div className="bi-page-actions"><button className="ghost-button" onClick={drillUp} disabled={!active.some((item) => item.key !== "period")}>Drill-up</button><button className="ghost-button" onClick={clearSelection}>Limpar seleção</button></div>
      </header>

      {error ? <div className="error-panel" role="alert"><div><span>Falha analítica</span><strong>Não foi possível montar este painel.</strong><p>{error}</p></div></div> : null}
      {loading && !data ? <div className="loading-screen"><span className="loading-mark" /><div><strong>Consultando a camada analítica</strong><p>Aplicando filtros e reconciliando os grupos…</p></div></div> : null}
      {data ? (
        <>
          {indicator === "received" ? (
            <>
              <section className="bi-metric-grid four">
                <MetricTile label="Recebidos no período" value={formatNumber(data.summary.comparison?.current.value)} detail={`${data.summary.comparison?.current.from} a ${data.summary.comparison?.current.to}`} />
                <MetricTile label={`Mesmo período de ${previousYear}`} value={formatNumber(data.summary.comparison?.previous.value)} detail="Comparação homóloga" tone="slate" />
                <MetricTile label="Variação absoluta" value={`${(data.summary.comparison?.absolute_change ?? 0) > 0 ? "+" : ""}${formatNumber(data.summary.comparison?.absolute_change)}`} detail="2026 menos 2025" tone={(data.summary.comparison?.absolute_change ?? 0) > 0 ? "orange" : "green"} />
                <MetricTile label="Variação percentual" value={formatPercent(data.summary.comparison?.change_percent)} detail="Períodos equivalentes" tone={(data.summary.comparison?.absolute_change ?? 0) > 0 ? "orange" : "green"} />
              </section>
              <section className="bi-layout-main">
                <article className="panel bi-primary-chart"><div className="panel-heading"><div><span className="eyebrow">GRÁFICO PRINCIPAL</span><h2>Recebidos por mês</h2><p>Clique no mês; os gráficos de macroprocesso, categoria e a tabela serão recalculados.</p></div><span className="panel-chip">{currentYear} × {previousYear}</span></div>
                  <MonthComparison data={data.summary.comparison?.monthly ?? []} currentYear={currentYear} previousYear={previousYear} selectedMonth={filters.month} onSelect={(month) => toggle("month", String(month))} />
                </article>
                <article className="panel"><div className="panel-heading"><div><span className="eyebrow">NÍVEL 2</span><h2>Macroprocessos</h2><p>Barras ordenadas no recorte ativo.</p></div></div><InteractiveBars items={items(data.macro, "macroprocess")} selected={filters.macro} onSelect={(item) => toggle("macro", item.key)} /></article>
              </section>
              <section className="bi-layout-secondary"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">NÍVEL 3</span><h2>Recebidos por categoria</h2><p>Expanda a lista sem ocultar o restante do universo.</p></div></div><InteractiveBars items={items(data.category, "category")} selected={filters.category} onSelect={(item) => toggle("category", item.key)} tone="teal" initialLimit={10} /></article><article className="panel bi-reading"><span className="eyebrow">LEITURA EM 5 SEGUNDOS</span><h2>{formatNumber(data.summary.meta.total)} protocolos no cruzamento</h2><p>A soma das categorias é {formatNumber(data.category.meta.grouped_sum)} e a reconciliação está {data.category.meta.grouping_reconciled ? "fechada" : "divergente"}.</p><strong>{data.summary.comparison?.rule}</strong></article></section>
            </>
          ) : null}

          {indicator === "outputs" ? (
            <>
              <section className="bi-metric-grid five">
                <MetricTile label="Saídas totais" value={formatNumber(data.summary.totals.outputs)} />
                <MetricTile label="Concluídos" value={formatNumber(data.summary.totals.concluded)} tone="green" />
                <MetricTile label="Encerrados" value={formatNumber(data.summary.totals.closed)} tone="slate" />
                <MetricTile label="Saldo recebido - saída" value={`${data.summary.totals.period_balance > 0 ? "+" : ""}${formatNumber(data.summary.totals.period_balance)}`} detail={data.summary.totals.period_balance > 0 ? "Estoque cresceu" : "Estoque reduziu"} tone={data.summary.totals.period_balance > 0 ? "orange" : "green"} />
                <MetricTile label={`Saídas em ${previousYear}`} value={formatNumber(data.summary.comparison?.previous.value)} detail={`${formatPercent(data.summary.comparison?.change_percent)} no período homólogo`} />
              </section>
              <section className="bi-layout-main"><article className="panel bi-primary-chart"><div className="panel-heading"><div><span className="eyebrow">FLUXO MENSAL</span><h2>Recebidos × Saídas</h2><p>O saldo em cada mês indica pressão ou redução do estoque.</p></div></div><MonthlyFlow data={data.summary.monthly_flow ?? []} selectedMonth={filters.month} onSelect={(month) => toggle("month", String(month))} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">COMPOSIÇÃO DO RESULTADO</span><h2>Concluído e Encerrado</h2><p>Resultados separados, sem equivalência semântica.</p></div></div><InteractiveBars items={items(data.secondary, "output_type")} selected={filters.outputType} onSelect={(item) => toggle("outputType", item.key)} tone="green" /></article></section>
              <section className="bi-layout-secondary"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">PRODUÇÃO POR CATEGORIA</span><h2>Categorias com mais saídas</h2><p>Clique na categoria e depois no tipo de saída para chegar aos protocolos.</p></div></div><InteractiveBars items={items(data.category, "category")} selected={filters.category} onSelect={(item) => toggle("category", item.key)} tone="teal" initialLimit={10} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">EVOLUÇÃO DO SALDO</span><h2>Recebidos - Saídas</h2><p>Positivo aumenta o estoque; negativo reduz.</p></div></div><BalanceEvolution data={data.summary.monthly_flow ?? []} selectedMonth={filters.month} onSelect={(month) => toggle("month", String(month))} /></article></section>
            </>
          ) : null}

          {indicator === "stock" ? (
            <>
              <section className="bi-metric-grid five"><MetricTile label="Estoque total" value={formatNumber(data.summary.totals.stock)} /><MetricTile label="Fila Interna SEPLAN" value={formatNumber(data.summary.totals.internal)} tone="blue" /><MetricTile label="Responsável externo" value={formatNumber(data.summary.totals.external)} tone="slate" /><MetricTile label="Paralisado" value={formatNumber(data.summary.totals.paralyzed)} tone="red" /><MetricTile label="Depende da SEPLAN" value={formatPercent(data.summary.totals.depends_on_seplan_percent)} detail="Fila interna / estoque" tone="teal" /></section>
              <section className="bi-layout-main"><article className="panel bi-primary-chart"><div className="panel-heading"><div><span className="eyebrow">COMPOSIÇÃO DO ESTOQUE</span><h2>Responsabilidade operacional</h2><p>Clique em um segmento para cruzar idade, gargalos e protocolos.</p></div></div><StackedComposition items={items(data.summary, "responsibility")} selected={filters.owner ? RESPONSIBILITY_TO_QUERY[filters.owner] : ""} onSelect={(item) => selectResponsibility(item.key)} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">IDADE DO ESTOQUE</span><h2>Faixas desde a abertura</h2><p>Responde à responsabilidade e aos demais filtros.</p></div></div><InteractiveBars items={items(data.secondary, "age_band")} selected={filters.ageBand} onSelect={(item) => toggle("ageBand", item.key)} tone="orange" /></article></section>
              <section className="bi-layout-secondary"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">GARGALOS · FOCO INICIAL INTERNO</span><h2>Categorias com maior estoque</h2><p>{filters.owner ? "Responsabilidade selecionada." : "Por padrão, este ranking prioriza a Fila Interna SEPLAN."}</p></div></div><InteractiveBars items={items(data.category, "category")} selected={filters.category} onSelect={(item) => selectCategoryFromStockPriority(item.key)} tone="red" initialLimit={10} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">CONCENTRAÇÃO OPERACIONAL</span><h2>Alternar dimensão</h2><p>Leitura gerencial; não é avaliação individual de servidor.</p></div><div className="dimension-switch"><button className={stockDimension === "macroprocess" ? "active" : ""} onClick={() => setStockDimension("macroprocess")}>Macroprocesso</button><button className={stockDimension === "category" ? "active" : ""} onClick={() => setStockDimension("category")}>Categoria</button><button className={stockDimension === "sector" ? "active" : ""} onClick={() => setStockDimension("sector")}>Setor</button><button disabled title="Exige autenticação e autorização para PII">Responsável 🔒</button></div></div><InteractiveBars items={items(data.concentration, stockDimension)} selected={filters[stockDimension === "macroprocess" ? "macro" : stockDimension]} onSelect={(item) => toggle(stockDimension === "macroprocess" ? "macro" : stockDimension, item.key)} tone="teal" initialLimit={8} /></article></section>
              <section className="panel bi-status-level"><div className="panel-heading"><div><span className="eyebrow">NÍVEL STATUS</span><h2>{filters.category ? `Status em ${filters.category}` : "Status do estoque selecionado"}</h2><p>Selecione primeiro uma categoria e depois um status para chegar ao conjunto exato de protocolos.</p></div><span className="panel-chip">Categoria → Status → Protocolos</span></div><InteractiveBars items={items(data.status, "status")} selected={filters.status} onSelect={(item) => toggle("status", item.key)} tone="blue" initialLimit={6} /></section>
            </>
          ) : null}

          {detail ? <BiDrillTable total={detail.total} items={detail.items} offset={detail.offset} limit={detail.limit} sortBy={sortBy} sortDir={sortDir} onPage={setOffset} onSort={(field) => { setOffset(0); if (sortBy === field) setSortDir((value) => value === "asc" ? "desc" : "asc"); else { setSortBy(field); setSortDir("asc"); } }} onProtocol={(protocol) => apply({ q: protocol })} exportHref={exportHref} privateDetail={data.detail.permissions.private_detail} /> : null}
        </>
      ) : null}
      {loading && data ? <div className="refresh-strip" aria-label="Recalculando painel"><i /></div> : null}
    </section>
  );
}
