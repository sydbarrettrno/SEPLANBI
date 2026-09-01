import { useEffect, useMemo, useState } from "react";
import { fetchDashboard, fetchExtendedIndicator } from "./api";
import { AdminDescriptions } from "./components/AdminDescriptions";
import { BarList } from "./components/BarList";
import { BiPanel } from "./components/BiPanel";
import { DrilldownTable } from "./components/DrilldownTable";
import { FilterBar } from "./components/FilterBar";
import { Header } from "./components/Header";
import { IndicatorCoverage } from "./components/IndicatorCoverage";
import { IndicatorDetail } from "./components/IndicatorDetail";
import { KpiCard } from "./components/KpiCard";
import { MonthlyFlowBarChart } from "./components/MonthlyFlowBarChart";
import { OverviewIndicatorPanel } from "./components/OverviewIndicatorPanel";
import { Sidebar } from "./components/Sidebar";
import { useDashboardContent } from "./content/DashboardContentContext";
import { formatDays, formatNumber, formatPercent, monthLabel } from "./format";
import type { DashboardData, DashboardFilters, DetailId, PageId, Recordset } from "./types";
import { drillBreadcrumb, publicAnalyticsExportUrl, type AnalyticsIndicator } from "./analytics";

const INITIAL_FILTERS: DashboardFilters = {
  from: "",
  to: "",
  year: "",
  month: "",
  macro: "",
  category: "",
  status: "",
  owner: "",
  sector: "",
  outputType: "",
  ageBand: "",
  q: "",
  threshold: "30",
  recordset: "all",
  offset: 0,
  limit: 50,
};

function comparisonLabel(value: number | null | undefined, subject: string) {
  if (value == null) return `${subject}: sem comparação`;
  const direction = value > 0 ? "↑" : value < 0 ? "↓" : "→";
  return `${direction} ${formatPercent(Math.abs(value))} vs. período anterior`;
}

interface AppProps {
  adminAuthorized?: boolean;
}

export default function App({ adminAuthorized = false }: AppProps) {
  const { copy } = useDashboardContent();
  const [page, setPage] = useState<PageId>("overview");
  const [selectedDetail, setSelectedDetail] = useState<DetailId>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>(INITIAL_FILTERS);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [turnaroundTrend, setTurnaroundTrend] = useState<Array<{ label: string; value: number | null }>>([]);

  useEffect(() => {
    const allowed: PageId[] = ["overview", "received", "outputs", "stock", "processes", "indicators", "admin"];
    const syncHash = () => {
      const candidate = window.location.hash.replace(/^#\/?/, "") as PageId;
      if (!allowed.includes(candidate)) return;
      if (candidate === "admin" && !adminAuthorized) return;
      setPage(candidate);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [adminAuthorized]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchDashboard(filters, controller.signal)
      .then((result) => {
        setData(result);
        if (!filters.from && !filters.to) {
          setFilters((current) => ({
            ...current,
            from: result.meta.period.from,
            to: result.meta.period.to,
          }));
        }
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar o painel.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, reloadKey]);

  useEffect(() => {
    if (!filters.from || !filters.to) {
      setTurnaroundTrend([]);
      return;
    }

    const controller = new AbortController();
    setTurnaroundTrend([]);
    fetchExtendedIndicator({
      kpi: 4,
      from: filters.from,
      to: filters.to,
      year: filters.year || undefined,
      month: filters.month || undefined,
      macro: filters.macro || undefined,
      category: filters.category || undefined,
      status: filters.status || undefined,
      sector: filters.sector || undefined,
      q: filters.q || undefined,
      limit: 1,
      offset: 0,
    }, controller.signal)
      .then((result) => {
        const monthly = result.comparison?.monthly ?? [];
        const fallbackYear = filters.year || filters.from.slice(0, 4);
        setTurnaroundTrend(monthly.map((item) => ({
          label: monthLabel(`${fallbackYear}-${String(item.month).padStart(2, "0")}`),
          value: typeof item.current === "number" ? item.current : null,
        })));
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setTurnaroundTrend([]);
      });
    return () => controller.abort();
  }, [filters.from, filters.to, filters.year, filters.month, filters.macro, filters.category, filters.status, filters.sector, filters.q]);

  const seasonality = useMemo(() => {
    const flow = data?.charts.flow ?? [];
    if (!flow.length) return null;
    const peakIn = flow.reduce((best, item) => item.received > best.received ? item : best);
    const valleyIn = flow.reduce((best, item) => item.received < best.received ? item : best);
    const peakOut = flow.reduce((best, item) => item.concluded > best.concluded ? item : best);
    return { peakIn, valleyIn, peakOut };
  }, [data]);

  const kpiTrends = useMemo(() => {
    if (!data) return null;
    const flow = data.charts.flow;
    const received = flow.map((item) => ({ label: monthLabel(item.month), value: item.received }));
    const concluded = flow.map((item) => ({ label: monthLabel(item.month), value: item.concluded }));
    const balance = flow.map((item) => ({ label: monthLabel(item.month), value: item.received - item.concluded }));

    const isCurrentCut = data.meta.period.to === data.meta.source_updated_at.slice(0, 10);
    const canReconstructStock = isCurrentCut && !filters.status && !filters.owner && !filters.sector;
    const stock = canReconstructStock
      ? (() => {
          let running = data.metrics.stock;
          const points = new Array<{ label: string; value: number }>(flow.length);
          for (let index = flow.length - 1; index >= 0; index -= 1) {
            const item = flow[index]!;
            points[index] = { label: monthLabel(item.month), value: running };
            running -= item.received - item.concluded;
          }
          return points;
        })()
      : [];

    return { received, concluded, balance, stock };
  }, [data, filters.status, filters.owner, filters.sector]);

  const openDetail = (detail: DetailId, recordset: Recordset) => {
    setSelectedDetail(detail);
    setPage("processes");
    setFilters((current) => ({ ...current, recordset, offset: 0 }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigate = (nextPage: PageId) => {
    if (nextPage === "admin" && !adminAuthorized) return;
    setPage(nextPage);
    window.history.pushState(null, "", `#/${nextPage}`);
    if (nextPage === "overview") {
      setSelectedDetail("all");
      setFilters((current) => ({ ...current, recordset: "all", offset: 0 }));
    } else if (nextPage === "processes") {
      setSelectedDetail("all");
      setFilters((current) => ({ ...current, recordset: "all", offset: 0 }));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const metrics = data?.metrics;
  const comparison = data?.management.comparison;
  const exportHref = useMemo(() => {
    const indicator: AnalyticsIndicator | null = selectedDetail === "received"
      ? "received"
      : selectedDetail === "concluded"
        ? "outputs"
        : (["stock", "external", "paralyzed"] as DetailId[]).includes(selectedDetail)
          ? "stock"
          : null;
    if (!indicator) return null;
    return publicAnalyticsExportUrl({
      indicator,
      from: filters.from,
      to: filters.to,
      macro: filters.macro ? [filters.macro] : undefined,
      category: filters.category ? [filters.category] : undefined,
      status: filters.status ? [filters.status] : undefined,
      sector: filters.sector ? [filters.sector] : undefined,
      outputType: filters.outputType ? [filters.outputType as "Concluído" | "Encerrado"] : undefined,
      ageBand: filters.ageBand ? [filters.ageBand] : undefined,
      year: filters.year ? [filters.year] : undefined,
      month: filters.month ? [Number(filters.month)] : undefined,
      search: filters.q,
    });
  }, [filters, selectedDetail]);

  const processCopy = copy.processes.details[selectedDetail];

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={navigate} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="app-main">
        <Header sourceDate={data?.meta.source_updated_at} scopeRows={data?.meta.scope_rows} onMenu={() => setMenuOpen(true)} />
        <main className="content">
          {page !== "admin" && page !== "indicators" ? (
            <FilterBar
              filters={filters}
              options={data?.options}
              loading={loading}
              onApply={(next) => setFilters({ ...next, recordset: page === "overview" ? "all" : next.recordset, offset: 0 })}
            />
          ) : null}

          {error ? (
            <section className="error-panel" role="alert">
              <div><span>Falha de conexão</span><strong>Os dados não puderam ser atualizados.</strong><p>{error}</p></div>
              <button className="primary-button" onClick={() => setReloadKey((key) => key + 1)}>Tentar novamente</button>
            </section>
          ) : null}

          {!data && loading ? (
            <section className="loading-screen" aria-live="polite">
              <span className="loading-mark" />
              <div><strong>Preparando a visão executiva</strong><p>Aplicando as regras oficiais à base validada…</p></div>
            </section>
          ) : null}

          {data && page === "overview" ? (
            <>
              <section className="page-hero overview-hero overview-hero-clean">
                <div>
                  <span className="eyebrow">VISÃO EXECUTIVA · {data.meta.period.from.slice(0, 4)}</span>
                  <h1>Indicadores de Desempenho</h1>
                  <p>Período de análise: {data.meta.period.from} — {data.meta.period.to}</p>
                </div>
              </section>

              {metrics ? (
                <section className="kpi-grid executive-kpi-grid" aria-label="Indicadores principais">
                  <KpiCard
                    icon="↗"
                    eyebrow="01 · RECEBIDOS"
                    value={formatNumber(metrics.received)}
                    description="Contagem de ProtocoloID pela DataAbertura no período."
                    detail={`${data.meta.period.from} → ${data.meta.period.to}`}
                    tone="blue"
                    trend={comparisonLabel(comparison?.received_change_percent, "Entradas")}
                    series={kpiTrends?.received}
                    onClick={() => navigate("received")}
                  />
                  <KpiCard
                    icon="✓"
                    eyebrow="02 · FINALIZADOS"
                    value={formatNumber(metrics.concluded)}
                    description="Concluído + Encerrado por DataSaida no período."
                    detail="Coorte do mês + passivo anterior absorvido"
                    tone="green"
                    trend={comparisonLabel(comparison?.cohort_concluded_change_percent, "Coorte concluída")}
                    series={kpiTrends?.concluded}
                    onClick={() => navigate("outputs")}
                  />
                  <KpiCard
                    icon="⇄"
                    eyebrow="SALDO MENSAL"
                    value={`${metrics.period_balance > 0 ? "+" : ""}${formatNumber(metrics.period_balance)}`}
                    description="Recebidos − saídas operacionais no período."
                    detail={`${formatNumber(metrics.received)} − ${formatNumber(metrics.concluded)}`}
                    tone={metrics.period_balance > 0 ? "orange" : "green"}
                    series={kpiTrends?.balance}
                    onClick={() => openDetail("balance", "all")}
                  />
                  <KpiCard
                    icon="▤"
                    eyebrow="03 · ESTOQUE"
                    value={formatNumber(metrics.stock)}
                    description="Protocolos em status não terminal na data de corte."
                    detail={`${formatNumber(metrics.internal_queue)} internos · ${formatNumber(metrics.external_wait)} externos · ${formatNumber(metrics.paralyzed)} paralisados`}
                    tone="orange"
                    series={kpiTrends?.stock}
                    onClick={() => navigate("stock")}
                  />
                  <KpiCard
                    icon="◷"
                    eyebrow="04 · TEMPO MEDIANO"
                    value={formatDays(metrics.turnaround.median_days)}
                    description="Mediana de DataFim − DataAbertura nas saídas elegíveis."
                    detail={`n=${formatNumber(metrics.turnaround.eligible)} · média ${formatDays(metrics.turnaround.mean_days)} · P90 ${formatDays(metrics.turnaround.p90_days)}`}
                    tone="purple"
                    series={turnaroundTrend}
                    onClick={() => window.location.hash = "#/kpi04"}
                  />
                </section>
              ) : null}

              <section className="overview-primary-analysis">
                <article className="panel flow-panel overview-flow-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">FLUXO MENSAL</span>
                      <h2>Recebidos × Finalizados</h2>
                      <p>Entradas e saídas por mês, com a saída decomposta entre coorte do próprio mês e passivo anterior absorvido.</p>
                    </div>
                    <span className="panel-chip">MENSAL</span>
                  </div>
                  <MonthlyFlowBarChart data={data.charts.flow} />
                </article>
                <OverviewIndicatorPanel data={data} filters={filters} />
              </section>

              <section className="overview-support-grid">
                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">{copy.overview.internalAging.eyebrow}</span>
                      <h2>{copy.overview.internalAging.title}</h2>
                      <p>{copy.overview.internalAging.description}</p>
                    </div>
                  </div>
                  <BarList data={data.charts.internal_aging} tone="orange" />
                </article>
                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">{copy.overview.responsibility.eyebrow}</span>
                      <h2>{copy.overview.responsibility.title}</h2>
                      <p>{copy.overview.responsibility.description}</p>
                    </div>
                  </div>
                  <BarList data={data.charts.owners} tone="teal" limit={7} />
                </article>
                <aside className="panel seasonality-panel">
                  <span className="eyebrow">{copy.overview.signals.eyebrow}</span>
                  <h2>{copy.overview.signals.title}</h2>
                  {seasonality ? (
                    <div className="seasonality-signals">
                      <div><i className="signal-blue" /><span><small>{copy.overview.signals.peakIn}</small><strong>{monthLabel(seasonality.peakIn.month)}</strong><p>{formatNumber(seasonality.peakIn.received)} protocolos</p></span></div>
                      <div><i className="signal-green" /><span><small>{copy.overview.signals.peakOut}</small><strong>{monthLabel(seasonality.peakOut.month)}</strong><p>{formatNumber(seasonality.peakOut.concluded)} conclusões</p></span></div>
                      <div><i className="signal-slate" /><span><small>{copy.overview.signals.valleyIn}</small><strong>{monthLabel(seasonality.valleyIn.month)}</strong><p>{formatNumber(seasonality.valleyIn.received)} protocolos</p></span></div>
                    </div>
                  ) : <p>{copy.overview.signals.empty}</p>}
                  <div className="management-note"><strong>{copy.overview.signals.howToTitle}</strong><p>{copy.overview.signals.howToText}</p></div>
                </aside>
              </section>
            </>
          ) : null}

          {data && page === "processes" ? (
            <section className="process-page">
              <nav className="drill-breadcrumb" aria-label="Caminho do detalhamento">
                {drillBreadcrumb(selectedDetail, filters).map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
              </nav>
              <div className="page-hero simple-hero">
                <div><span className="eyebrow">{processCopy.eyebrow}</span><h1>{processCopy.title}</h1><p>{processCopy.description}</p></div>
                <div className="recordset-label"><small>{copy.processes.recordsetLabel}</small><strong>{data.records.recordset === "all" ? copy.processes.allLabel : data.records.recordset}</strong></div>
              </div>
              <IndicatorDetail data={data} detail={selectedDetail} />
              <DrilldownTable
                records={data.records}
                onPage={(offset) => setFilters((current) => ({ ...current, offset }))}
                onProtocol={(protocol) => setFilters((current) => ({ ...current, q: protocol, offset: 0 }))}
                exportHref={exportHref}
              />
            </section>
          ) : null}

          {data && page === "received" ? <BiPanel indicator="received" filters={filters} onFilters={(next) => setFilters({ ...next, recordset: "all", offset: 0 })} /> : null}
          {data && page === "outputs" ? <BiPanel indicator="outputs" filters={filters} onFilters={(next) => setFilters({ ...next, recordset: "all", offset: 0 })} /> : null}
          {data && page === "stock" ? <BiPanel indicator="stock" filters={filters} onFilters={(next) => setFilters({ ...next, recordset: "all", offset: 0 })} /> : null}

          {data && page === "indicators" ? <IndicatorCoverage items={data.indicator_coverage} /> : null}

          {page === "admin" && adminAuthorized ? <AdminDescriptions /> : null}

          {data ? (
            <footer className="data-footer">
              <span>Fonte: {data.meta.dataset} · esquema v{data.meta.schema_version} · taxonomia {data.meta.taxonomy_version}</span>
              <span>{data.meta.privacy_note}</span>
            </footer>
          ) : null}
        </main>
        {loading && data ? <div className="refresh-strip" aria-label="Atualizando dados"><i /></div> : null}
      </div>
    </div>
  );
}
