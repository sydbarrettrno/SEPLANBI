import { useEffect, useMemo, useState } from "react";
import { fetchExtendedIndicator } from "../api";
import { formatNumber, formatPercent } from "../format";
import type { DashboardFilters } from "../types";
import type { ExtendedResponse } from "../extended";

interface Props {
  kpi: 7 | 9;
  filters: DashboardFilters;
}

interface MonthlyPoint {
  month: string;
  first: number;
  second: number;
}

interface CohortInfo {
  received_cohort: number;
  responded_from_received_cohort: number;
  open_from_received_cohort: number;
  response_rate_percent: number | null;
  reference_date: string;
  rule: string;
}

type TrendResponse = ExtendedResponse & { cohort?: CohortInfo };

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${MONTHS[Number(month) - 1] ?? month}/${year.slice(2)}`;
}

export function IndicatorMonthlyTrend({ kpi, filters }: Props) {
  const [data, setData] = useState<TrendResponse | null>(null);

  const request = useMemo(() => ({
    kpi,
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
  }), [filters, kpi]);

  useEffect(() => {
    const controller = new AbortController();
    fetchExtendedIndicator(request, controller.signal)
      .then((response) => setData(response as TrendResponse))
      .catch(() => setData(null));
    return () => controller.abort();
  }, [request]);

  const points: MonthlyPoint[] = (data?.monthly ?? []).flatMap((raw) => {
    const month = typeof raw.month === "string" ? raw.month : "";
    if (!month) return [];
    if (kpi === 7) {
      return [{ month, first: Number(raw.events ?? 0), second: Number(raw.protocols ?? 0) }];
    }
    return [{ month, first: Number(raw.received ?? 0), second: Number(raw.responded ?? 0) }];
  });

  if (!points.length) return null;
  const max = Math.max(1, ...points.flatMap((point) => [point.first, point.second]));
  const labels = kpi === 7
    ? { eyebrow: "EVOLUÇÃO MENSAL", title: "Diligências registradas por mês", first: "Eventos", second: "Protocolos afetados", note: "Cobertura incremental da base disponível; não representa o histórico integral anterior ao extrato." }
    : { eyebrow: "EVOLUÇÃO MENSAL", title: "Denúncias recebidas × respondidas", first: "Recebidas", second: "Respondidas", note: "As duas barras representam fluxos mensais. A taxa de atendimento usa, separadamente, a mesma coorte de denúncias recebidas." };

  return (
    <section className="panel indicator-monthly-panel" aria-label={labels.title}>
      <div className="panel-heading">
        <div><span className="eyebrow">{labels.eyebrow}</span><h2>{labels.title}</h2><p>{labels.note}</p></div>
        <div className="bi-legend"><span><i className="current" />{labels.first}</span><span><i className="outputs" />{labels.second}</span></div>
      </div>
      {kpi === 9 && data?.cohort ? (
        <div className="cohort-callout">
          <div><small>Coorte recebida</small><strong>{formatNumber(data.cohort.received_cohort)}</strong></div>
          <div><small>Da coorte já respondidas</small><strong>{formatNumber(data.cohort.responded_from_received_cohort)}</strong></div>
          <div><small>Taxa da mesma coorte</small><strong>{formatPercent(data.cohort.response_rate_percent)}</strong></div>
          <p>{data.cohort.rule}</p>
        </div>
      ) : null}
      <div className="indicator-monthly-bars">
        {points.map((point) => (
          <div className="indicator-month" key={point.month} title={`${monthLabel(point.month)}: ${formatNumber(point.first)} ${labels.first.toLowerCase()}, ${formatNumber(point.second)} ${labels.second.toLowerCase()}.`}>
            <div className="indicator-month-values"><strong>{formatNumber(point.first)}</strong><strong>{formatNumber(point.second)}</strong></div>
            <div className="indicator-month-columns">
              <i className="series-first" style={{ height: `${Math.max(3, point.first / max * 100)}%` }} />
              <i className="series-second" style={{ height: `${Math.max(3, point.second / max * 100)}%` }} />
            </div>
            <span>{monthLabel(point.month)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
