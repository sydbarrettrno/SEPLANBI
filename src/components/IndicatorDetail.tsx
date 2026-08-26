import { formatDays, formatNumber, formatPercent, monthLabel } from "../format";
import type { DashboardData, DetailId, NamedValue } from "../types";
import { BarList } from "./BarList";
import { FlowChart } from "./FlowChart";

interface IndicatorDetailProps {
  data: DashboardData;
  detail: DetailId;
}

export const DETAIL_COPY: Record<DetailId, { eyebrow: string; title: string; description: string; note: string }> = {
  all: { eyebrow: "PAINEL OPERACIONAL", title: "Panorama dos protocolos", description: "Composição geral do recorte selecionado e registros que sustentam os indicadores.", note: "Use os filtros para localizar um conjunto específico ou retorne à visão executiva e escolha um indicador." },
  received: { eyebrow: "INDICADOR 01 · RECEBIDOS", title: "Detalhe das novas demandas", description: "Evolução mensal e categorias dos protocolos abertos no período selecionado.", note: "Picos recorrentes de entrada ajudam a antecipar sazonalidade e necessidade de capacidade." },
  concluded: { eyebrow: "INDICADOR 02 · CONCLUÍDOS", title: "Detalhe das entregas", description: "Produção operacional mensal, encerramentos formais e categorias concluídas.", note: "A conclusão operacional reconhece a entrega; o encerramento formal permanece apresentado separadamente." },
  balance: { eyebrow: "FLUXO · CAPACIDADE", title: "Entradas versus conclusões", description: "Leitura mensal da pressão de demanda e da capacidade de absorção do passivo.", note: "Saldo positivo indica entradas acima das conclusões e tende a pressionar o estoque." },
  stock: { eyebrow: "INDICADOR 03 · ESTOQUE", title: "Detalhe das pendências", description: "Idade, situação e concentração dos processos pendentes na data final do recorte.", note: "O estoque considera a posição na data final, e não apenas os processos abertos no período." },
  time: { eyebrow: "INDICADOR 04 · TEMPO", title: "Tempo por processo concluído", description: "Média, mediana e percentil 90 dos processos entregues no período.", note: "A mediana representa o processo típico; o P90 evidencia os casos que mais alongam o prazo." },
  stopped: { eyebrow: "INDICADOR 05 · PARADOS", title: "Fila interna sem movimentação", description: "Distribuição das pendências internas por faixa de tempo e responsabilidade.", note: "Este indicador usa somente a fila interna da SEPLAN como denominador." },
  external: { eyebrow: "GESTÃO POR EXCEÇÃO", title: "Dependências externas", description: "Processos aguardando requerente, responsável técnico ou terceiro.", note: "Esses processos exigem acompanhamento de retorno, mas não representam trabalho interno disponível." },
  suspended: { eyebrow: "GESTÃO POR EXCEÇÃO", title: "Processos suspensos", description: "Casos fora da fila ativa que permanecem visíveis para controle administrativo.", note: "A suspensão não equivale a conclusão e precisa de revisão periódica da situação." },
};

function balanceByMonth(data: DashboardData): NamedValue[] {
  return data.charts.flow.map((item) => {
    const balance = item.received - item.concluded;
    return { name: `${balance >= 0 ? "Pressão" : "Absorção"} · ${monthLabel(item.month)}`, value: Math.abs(balance) };
  });
}

export function IndicatorDetail({ data, detail }: IndicatorDetailProps) {
  const metrics = data.metrics;
  const comparison = data.management.comparison;
  const copy = DETAIL_COPY[detail];

  const stats: Record<DetailId, Array<{ label: string; value: string }>> = {
    all: [
      { label: "Protocolos no recorte", value: formatNumber(data.meta.scope_rows) },
      { label: "Estoque atual", value: formatNumber(metrics.stock) },
      { label: "Conclusões", value: formatNumber(metrics.concluded) },
    ],
    received: [
      { label: "Recebidos", value: formatNumber(metrics.received) },
      { label: "Variação", value: formatPercent(comparison.received_change_percent) },
      { label: "Média mensal", value: formatNumber(Math.round(metrics.received / Math.max(1, data.charts.flow.length))) },
    ],
    concluded: [
      { label: "Conclusões operacionais", value: formatNumber(metrics.concluded) },
      { label: "Encerramentos formais", value: formatNumber(metrics.concluded_formal) },
      { label: "Conclusões / recebidos", value: formatPercent(metrics.completion_rate) },
    ],
    balance: [
      { label: "Saldo do período", value: `${metrics.period_balance > 0 ? "+" : ""}${formatNumber(metrics.period_balance)}` },
      { label: "Entradas", value: formatNumber(metrics.received) },
      { label: "Conclusões", value: formatNumber(metrics.concluded) },
    ],
    stock: [
      { label: "Estoque", value: formatNumber(metrics.stock) },
      { label: "Fila interna", value: formatNumber(metrics.internal_queue) },
      { label: "Aguardando externo", value: formatNumber(metrics.external_wait) },
    ],
    time: [
      { label: "Média", value: formatDays(metrics.turnaround.mean_days) },
      { label: "Mediana", value: formatDays(metrics.turnaround.median_days) },
      { label: "P90", value: formatDays(metrics.turnaround.p90_days) },
    ],
    stopped: [
      { label: "Acima do limite", value: formatNumber(metrics.stopped.count) },
      { label: "% da fila interna", value: formatPercent(metrics.stopped.percent) },
      { label: "Limite aplicado", value: `${metrics.stopped.threshold_days} dias` },
    ],
    external: [
      { label: "Dependências externas", value: formatNumber(metrics.external_wait) },
      { label: "% do estoque", value: formatPercent(data.management.position.external_percent) },
      { label: "Estoque total", value: formatNumber(metrics.stock) },
    ],
    suspended: [
      { label: "Suspensos", value: formatNumber(metrics.suspended) },
      { label: "Estoque total", value: formatNumber(metrics.stock) },
      { label: "Fila ativa interna", value: formatNumber(metrics.internal_queue) },
    ],
  };

  const flowFocus = detail === "received" ? "received" : detail === "concluded" ? "concluded" : "all";
  const usesFlow = ["all", "received", "concluded", "balance"].includes(detail);
  const primaryBars: Record<DetailId, NamedValue[]> = {
    all: data.charts.categories,
    received: data.charts.received_categories,
    concluded: data.charts.concluded_categories,
    balance: balanceByMonth(data),
    stock: data.charts.aging,
    time: [
      { name: "Média", value: metrics.turnaround.mean_days ?? 0 },
      { name: "Mediana", value: metrics.turnaround.median_days ?? 0 },
      { name: "Percentil 90", value: metrics.turnaround.p90_days ?? 0 },
    ],
    stopped: data.charts.internal_aging,
    external: data.charts.statuses,
    suspended: data.charts.statuses,
  };
  const secondaryBars: Record<DetailId, NamedValue[]> = {
    all: data.charts.statuses,
    received: data.charts.received_categories,
    concluded: data.charts.concluded_categories,
    balance: balanceByMonth(data),
    stock: data.charts.internal_categories,
    time: data.charts.concluded_categories,
    stopped: data.charts.owners,
    external: data.charts.categories,
    suspended: data.charts.categories,
  };
  const primaryTitles: Record<DetailId, string> = {
    all: "Fluxo mensal do recorte", received: "Entradas por mês", concluded: "Conclusões por mês", balance: "Capacidade mensal",
    stock: "Estoque por faixa de tempo", time: "Distribuição do tempo de tramitação", stopped: "Fila interna por tempo sem movimento",
    external: "Situação das dependências externas", suspended: "Situação dos processos suspensos",
  };
  const secondaryTitles: Record<DetailId, string> = {
    all: "Situação dos protocolos", received: "Categorias que mais receberam", concluded: "Categorias que mais concluíram", balance: "Magnitude do saldo mensal",
    stock: "Categorias na fila interna", time: "Categorias dos processos concluídos", stopped: "Concentração por responsabilidade",
    external: "Categorias aguardando retorno", suspended: "Categorias dos suspensos",
  };
  const categoryDetails: DetailId[] = ["received", "concluded", "stock", "time", "external", "suspended"];
  const secondaryLimit = categoryDetails.includes(detail) ? 12 : 8;

  return (
    <>
      <section className="detail-stat-grid" aria-label={`Resumo de ${copy.title}`}>
        {stats[detail].map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong></article>)}
      </section>
      <section className="analytics-grid indicator-detail-grid">
        <article className="panel detail-primary-chart">
          <div className="panel-heading"><div><span className="eyebrow">GRÁFICO PRINCIPAL</span><h2>{primaryTitles[detail]}</h2><p>{copy.description}</p></div></div>
          {usesFlow ? <FlowChart data={data.charts.flow} focus={flowFocus} /> : <BarList data={primaryBars[detail]} tone={detail === "stopped" ? "red" : detail === "time" ? "blue" : "orange"} limit={8} />}
        </article>
        <article className="panel detail-secondary-chart">
          <div className="panel-heading"><div><span className="eyebrow">COMPOSIÇÃO</span><h2>{secondaryTitles[detail]}</h2></div></div>
          <BarList data={secondaryBars[detail]} tone={detail === "concluded" ? "teal" : detail === "stopped" ? "red" : "blue"} limit={secondaryLimit} />
          <div className="detail-reading"><strong>Leitura gerencial</strong><p>{copy.note}</p></div>
        </article>
      </section>
    </>
  );
}
