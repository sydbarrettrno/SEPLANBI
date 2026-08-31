import { useEffect, useMemo, useState } from "react";
import { fetchExtendedIndicator } from "../api";
import { formatNumber } from "../format";
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

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${MONTHS[Number(month) - 1] ?? month}/${year.slice(2)}`;
}

export function IndicatorMonthlyTrend({ kpi, filters }: Props) {
  const [data, setData] = useState<ExtendedResponse | null>(null);

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
      .then(setData)
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
    : { eyebrow: "EVOLUÇÃO MENSAL", title: "Denúncias recebidas × respondidas", first: "Recebidas", second: "Respondidas", note: "As respostas usam a saída operacional homologada da categoria Denúncia." };

  return (
    <section className="panel indicator-monthly-panel" aria-label={labels.title}>
      <div className="panel-heading">
        <div><span className="eyebrow">{labels.eyebrow}</span><h2>{labels.title}</h2><p>{labels.note}</p></div>
        <div className="bi-legend"><span><i className="current" />{labels.first}</span><span><i className="outputs" />{labels.second}</span></div>
      </div>
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
