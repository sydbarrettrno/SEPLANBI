import { formatNumber, formatPercent } from "../format";
import type { DashboardMetrics } from "../types";

interface ExceptionPanelProps {
  metrics: DashboardMetrics;
  onOpen: (recordset: "stock" | "stopped") => void;
}

export function ExceptionPanel({ metrics, onOpen }: ExceptionPanelProps) {
  const exceptions = [
    {
      title: "Fila interna parada",
      value: formatNumber(metrics.stopped.count),
      context: `${formatPercent(metrics.stopped.percent)} da fila interna acima de ${metrics.stopped.threshold_days} dias`,
      tone: "critical",
      recordset: "stopped" as const,
      action: "Prioridade imediata",
    },
    {
      title: "Dependência externa",
      value: formatNumber(metrics.external_wait),
      context: "aguardando requerente, responsável técnico ou terceiro",
      tone: "warning",
      recordset: "stock" as const,
      action: "Acompanhar retorno",
    },
    {
      title: "Processos suspensos",
      value: formatNumber(metrics.suspended),
      context: "fora da fila ativa, mantidos visíveis para controle",
      tone: "neutral",
      recordset: "stock" as const,
      action: "Revisar situação",
    },
  ];

  return (
    <section className="exceptions" aria-labelledby="exceptions-title">
      <div className="section-heading compact">
        <div><span className="eyebrow">GESTÃO POR EXCEÇÃO</span><h2 id="exceptions-title">Onde agir agora</h2></div>
        <p>O painel traz primeiro as condições que exigem decisão ou acompanhamento.</p>
      </div>
      <div className="exception-grid">
        {exceptions.map((item) => (
          <button key={item.title} className={`exception-card ${item.tone}`} onClick={() => onOpen(item.recordset)}>
            <span className="exception-signal" aria-hidden="true" />
            <div><small>{item.action}</small><h3>{item.title}</h3><p>{item.context}</p></div>
            <strong>{item.value}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
