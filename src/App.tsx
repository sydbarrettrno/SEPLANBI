import { useEffect, useMemo, useState } from "react";
import { fetchDashboard } from "./api";
import { AdminDescriptions } from "./components/AdminDescriptions";
import { BarList } from "./components/BarList";
import { DrilldownTable } from "./components/DrilldownTable";
import { ExceptionPanel } from "./components/ExceptionPanel";
import { FilterBar } from "./components/FilterBar";
import { FlowChart } from "./components/FlowChart";
import { Header } from "./components/Header";
import { IndicatorCoverage } from "./components/IndicatorCoverage";
import { DETAIL_COPY, IndicatorDetail } from "./components/IndicatorDetail";
import { KpiCard } from "./components/KpiCard";
import { Sidebar } from "./components/Sidebar";
import { formatDays, formatNumber, formatPercent, monthLabel } from "./format";
import type { CardDescriptionMap, DashboardData, DashboardFilters, DetailId, PageId, Recordset } from "./types";

const DESCRIPTION_KEY = "seplan.card-descriptions.v1";

const DEFAULT_DESCRIPTIONS: CardDescriptionMap = {
  received: "Demandas que entraram na SEPLAN durante o período selecionado.",
  concluded: "Produção entregue, incluindo conclusões operacionais reconhecidas.",
  balance: "Diferença entre entradas e conclusões; saldo positivo pressiona o estoque.",
  stock: "Pendências existentes na data final do recorte, independentemente da abertura.",
  time: "Tempo entre abertura e conclusão dos processos entregues no período.",
};

const INITIAL_FILTERS: DashboardFilters = {
  from: "",
  to: "",
  macro: "",
  category: "",
  status: "",
  owner: "",
  q: "",
  threshold: "30",
  recordset: "all",
  offset: 0,
  limit: 50,
};

function loadDescriptions(): CardDescriptionMap {
  try {
    const stored = window.localStorage.getItem(DESCRIPTION_KEY);
    return stored ? { ...DEFAULT_DESCRIPTIONS, ...JSON.parse(stored) } : DEFAULT_DESCRIPTIONS;
  } catch {
    return DEFAULT_DESCRIPTIONS;
  }
}

function comparisonLabel(value: number | null | undefined, subject: string) {
  if (value == null) return `${subject}: sem comparação`;
  const direction = value > 0 ? "↑" : value < 0 ? "↓" : "→";
  return `${direction} ${formatPercent(Math.abs(value))} vs. período anterior`;
}

export default function App() {
  const [page, setPage] = useState<PageId>("overview");
  const [selectedDetail, setSelectedDetail] = useState<DetailId>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>(INITIAL_FILTERS);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [descriptions, setDescriptions] = useState<CardDescriptionMap>(loadDescriptions);

  useEffect(() => {
    window.localStorage.setItem(DESCRIPTION_KEY, JSON.stringify(descriptions));
  }, [descriptions]);

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

  const seasonality = useMemo(() => {
    const flow = data?.charts.flow ?? [];
    if (!flow.length) return null;
    const peakIn = flow.reduce((best, item) => item.received > best.received ? item : best);
    const valleyIn = flow.reduce((best, item) => item.received < best.received ? item : best);
    const peakOut = flow.reduce((best, item) => item.concluded > best.concluded ? item : best);
    return { peakIn, valleyIn, peakOut };
  }, [data]);

  const openDetail = (detail: DetailId, recordset: Recordset) => {
    setSelectedDetail(detail);
    setPage("processes");
    setFilters((current) => ({ ...current, recordset, offset: 0 }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigate = (nextPage: PageId) => {
    setPage(nextPage);
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
              <section className="page-hero overview-hero">
                <div>
                  <span className="eyebrow">VISÃO EXECUTIVA · {data.meta.period.from.slice(0, 4)}</span>
                  <h1>O que os processos estão dizendo?</h1>
                  <p>Entradas, entregas, sazonalidade e exceções organizadas para orientar a próxima decisão.</p>
                </div>
                <div className="hero-summary">
                  <small>BALANÇO DO PERÍODO</small>
                  <strong className={(metrics?.period_balance ?? 0) > 0 ? "pressure" : "positive"}>
                    {(metrics?.period_balance ?? 0) > 0 ? "+" : ""}{formatNumber(metrics?.period_balance)}
                  </strong>
                  <span>{(metrics?.period_balance ?? 0) > 0 ? "entradas acima das conclusões" : "conclusões absorveram as entradas"}</span>
                </div>
              </section>

              {metrics ? (
                <section className="kpi-grid" aria-label="Indicadores principais">
                  <KpiCard icon="↗" eyebrow="01 · RECEBIDOS" value={formatNumber(metrics.received)} description={descriptions.received} detail="Ver processos recebidos" tone="blue" trend={comparisonLabel(comparison?.received_change_percent, "Entradas")} onClick={() => openDetail("received", "received")} />
                  <KpiCard icon="✓" eyebrow="02 · CONCLUÍDOS" value={formatNumber(metrics.concluded)} description={descriptions.concluded} detail="Ver processos concluídos" tone="green" trend={comparisonLabel(comparison?.cohort_concluded_change_percent, "Entregas")} onClick={() => openDetail("concluded", "concluded")} />
                  <KpiCard icon="⇄" eyebrow="FLUXO · SALDO" value={`${metrics.period_balance > 0 ? "+" : ""}${formatNumber(metrics.period_balance)}`} description={descriptions.balance} detail={`${formatPercent(metrics.completion_rate)} concluídos/recebidos`} tone={metrics.period_balance > 0 ? "orange" : "green"} onClick={() => openDetail("balance", "all")} />
                  <KpiCard icon="▤" eyebrow="03 · ESTOQUE" value={formatNumber(metrics.stock)} description={descriptions.stock} detail={`${formatNumber(metrics.internal_queue)} na fila interna`} tone="orange" onClick={() => openDetail("stock", "stock")} />
                  <KpiCard icon="◷" eyebrow="04 · TEMPO MÉDIO" value={formatDays(metrics.turnaround.mean_days)} description={descriptions.time} detail={`Mediana ${formatDays(metrics.turnaround.median_days)} · P90 ${formatDays(metrics.turnaround.p90_days)}`} tone="purple" onClick={() => openDetail("time", "concluded")} />
                </section>
              ) : null}

              <section className="executive-workspace">
                <div className="executive-charts">
                  <section className="analytics-grid main-analysis">
                    <article className="panel flow-panel">
                      <div className="panel-heading">
                        <div><span className="eyebrow">TENDÊNCIA E SAZONALIDADE</span><h2>Entradas x entregas por mês</h2><p>A linha revela picos de demanda e a capacidade de resposta ao longo do ano.</p></div>
                        <span className="panel-chip">Mensal</span>
                      </div>
                      <FlowChart data={data.charts.flow} />
                    </article>
                    <aside className="panel seasonality-panel">
                      <span className="eyebrow">LEITURA AUTOMÁTICA</span>
                      <h2>Sinais do período</h2>
                      {seasonality ? (
                        <div className="seasonality-signals">
                          <div><i className="signal-blue" /><span><small>Pico de entrada</small><strong>{monthLabel(seasonality.peakIn.month)}</strong><p>{formatNumber(seasonality.peakIn.received)} protocolos</p></span></div>
                          <div><i className="signal-green" /><span><small>Pico de entrega</small><strong>{monthLabel(seasonality.peakOut.month)}</strong><p>{formatNumber(seasonality.peakOut.concluded)} conclusões</p></span></div>
                          <div><i className="signal-slate" /><span><small>Menor entrada</small><strong>{monthLabel(seasonality.valleyIn.month)}</strong><p>{formatNumber(seasonality.valleyIn.received)} protocolos</p></span></div>
                        </div>
                      ) : <p>Sem série mensal suficiente para leitura.</p>}
                      <div className="management-note"><strong>Como usar</strong><p>Compare picos recorrentes entre anos antes de redistribuir equipe ou definir prazo.</p></div>
                    </aside>
                  </section>

                  <section className="analytics-grid secondary-analysis">
                    <article className="panel">
                      <div className="panel-heading"><div><span className="eyebrow">FILA INTERNA</span><h2>Tempo sem movimentação</h2><p>Distribuição das pendências sob gestão direta da SEPLAN.</p></div></div>
                      <BarList data={data.charts.internal_aging} tone="orange" />
                    </article>
                    <article className="panel">
                      <div className="panel-heading"><div><span className="eyebrow">RESPONSABILIDADE</span><h2>Pendências por responsável</h2><p>Concentrações que podem exigir redistribuição ou apoio.</p></div></div>
                      <BarList data={data.charts.owners} tone="teal" limit={7} />
                    </article>
                  </section>
                </div>
                {metrics ? <ExceptionPanel metrics={metrics} onOpen={openDetail} /> : null}
              </section>
            </>
          ) : null}

          {data && page === "processes" ? (
            <section className="process-page">
              <div className="page-hero simple-hero">
                <div><span className="eyebrow">{DETAIL_COPY[selectedDetail].eyebrow}</span><h1>{DETAIL_COPY[selectedDetail].title}</h1><p>{DETAIL_COPY[selectedDetail].description}</p></div>
                <div className="recordset-label"><small>RECORTE ATIVO</small><strong>{data.records.recordset === "all" ? "Todos os protocolos" : data.records.recordset}</strong></div>
              </div>
              <IndicatorDetail data={data} detail={selectedDetail} />
              <DrilldownTable records={data.records} onPage={(offset) => setFilters((current) => ({ ...current, offset }))} />
            </section>
          ) : null}

          {data && page === "indicators" ? <IndicatorCoverage items={data.indicator_coverage} /> : null}

          {page === "admin" ? (
            <AdminDescriptions
              descriptions={descriptions}
              defaults={DEFAULT_DESCRIPTIONS}
              onChange={(key, value) => setDescriptions((current) => ({ ...current, [key]: value }))}
              onReset={() => setDescriptions(DEFAULT_DESCRIPTIONS)}
            />
          ) : null}

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
