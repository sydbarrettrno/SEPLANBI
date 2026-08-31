import { useEffect, useMemo, useState } from "react";
import { fetchExtendedIndicator } from "../api";
import { formatNumber, formatPercent } from "../format";
import type { ExtendedResponse } from "../extended";
import type { DashboardData, DashboardFilters } from "../types";

interface Props {
  data: DashboardData;
  filters: DashboardFilters;
}

type Tone = "red" | "orange" | "blue" | "green" | "purple" | "teal" | "slate";

interface CompactIndicatorProps {
  code: string;
  title: string;
  value: string;
  formula: string;
  detail: string;
  tone: Tone;
  status?: string;
  href: string;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function CompactIndicator({ code, title, value, formula, detail, tone, status, href }: CompactIndicatorProps) {
  return (
    <a className={`overview-mini-indicator mini-tone-${tone}`} href={href}>
      <span className="overview-mini-accent" />
      <div className="overview-mini-heading">
        <span><b>{code}</b>{title}</span>
        {status ? <em>{status}</em> : null}
      </div>
      <strong>{value}</strong>
      <p>{formula}</p>
      <small>{detail}</small>
    </a>
  );
}

export function OverviewIndicatorPanel({ data, filters }: Props) {
  const [diligence, setDiligence] = useState<ExtendedResponse | null>(null);

  const diligenceRequest = useMemo(() => ({
    kpi: 7 as const,
    from: filters.from,
    to: filters.to,
    year: filters.year,
    month: filters.month,
    macro: filters.macro,
    category: filters.category,
    status: filters.status,
    sector: filters.sector,
    q: filters.q,
    limit: 1,
  }), [filters.category, filters.from, filters.macro, filters.month, filters.q, filters.sector, filters.status, filters.to, filters.year]);

  useEffect(() => {
    const controller = new AbortController();
    fetchExtendedIndicator(diligenceRequest, controller.signal)
      .then(setDiligence)
      .catch(() => setDiligence(null));
    return () => controller.abort();
  }, [diligenceRequest]);

  const diligenceMetrics = diligence?.metrics ?? undefined;
  const diligenceEvents = asNumber(diligenceMetrics?.diligence_events);
  const diligenceProtocols = asNumber(diligenceMetrics?.protocols_with_diligence);
  const complaints = data.management.complaints;
  const projects = data.management.public_projects;
  const stopped = data.metrics.stopped;

  return (
    <aside className="panel overview-indicators-panel" aria-label="Indicadores complementares">
      <div className="overview-indicators-heading">
        <div>
          <span className="eyebrow">CONTROLE GERENCIAL</span>
          <h2>Demais indicadores</h2>
        </div>
        <small>Clique para abrir a análise</small>
      </div>

      <div className="overview-mini-grid">
        <CompactIndicator
          code="05"
          title={`Parados > ${stopped.threshold_days} dias`}
          value={formatPercent(stopped.percent)}
          formula={`${formatNumber(stopped.count)} ÷ ${formatNumber(stopped.eligible_stock)} da fila interna`}
          detail="DiasSemMovimento > limite · somente SEPLAN"
          tone="red"
          href="#/kpi05"
        />
        <CompactIndicator
          code="06"
          title="Concluídos dentro do prazo"
          value="—"
          formula="SLA por categoria + suspensões oficiais"
          detail="Sem regra oficial: percentual não publicável"
          tone="slate"
          status="NÃO HOMOLOGADO"
          href="#/kpi06"
        />
        <CompactIndicator
          code="07"
          title="Diligências por processo"
          value={diligence ? formatNumber(diligenceEvents) : "…"}
          formula="Eventos DILIGENCIA registrados na base disponível"
          detail={diligence ? `${formatNumber(diligenceProtocols)} protocolos afetados · cobertura parcial` : "Carregando cobertura incremental"}
          tone="orange"
          status="PARCIAL"
          href="#/kpi07"
        />
        <CompactIndicator
          code="08"
          title="Fiscalizações realizadas"
          value="—"
          formula="Ato realizado exige evidência estruturada"
          detail="Protocolo de fiscalização ≠ fiscalização realizada"
          tone="slate"
          status="NÃO HOMOLOGADO"
          href="#/kpi08"
        />
        <CompactIndicator
          code="09"
          title="Denúncias recebidas / respondidas"
          value={`${formatNumber(complaints.responded_operational)} / ${formatNumber(complaints.received)}`}
          formula="Respondidas operacionais ÷ denúncias recebidas"
          detail={`${formatNumber(complaints.stock)} denúncias permanecem no estoque`}
          tone="teal"
          href="#/kpi09"
        />
        <CompactIndicator
          code="10"
          title="Projetos públicos por etapa"
          value={formatNumber(projects.protocols_identified)}
          formula="Carteira própria agrupada pela fase atual"
          detail={projects.reference_date ? `Referência: ${projects.reference_date}` : "Base específica de projetos públicos"}
          tone="blue"
          href="#/kpi10"
        />
        <CompactIndicator
          code="11"
          title="Pendências por responsável / setor"
          value={formatNumber(data.metrics.stock)}
          formula="Estoque não terminal por responsabilidade operacional"
          detail={`${formatNumber(data.metrics.internal_queue)} internas · ${formatNumber(data.metrics.external_wait)} externas · ${formatNumber(data.metrics.paralyzed)} paralisadas`}
          tone="purple"
          href="#/kpi11"
        />
      </div>
    </aside>
  );
}
