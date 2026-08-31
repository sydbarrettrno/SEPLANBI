import { useEffect, useMemo, useState } from "react";
import { fetchExtendedIndicator } from "../api";
import { formatDays, formatNumber, formatPercent } from "../format";
import type { DashboardFilters } from "../types";
import type { ExtendedResponse } from "../extended";
import { MonthComparison } from "./BiVisuals";

interface Props {
  filters: DashboardFilters;
  onMonth: (month: string) => void;
}

interface PeriodStats {
  from: string;
  to: string;
  eligible: number;
  median_days: number | null;
  mean_days: number | null;
  p90_days: number | null;
}

interface TimeComparison {
  current: PeriodStats;
  previous: PeriodStats;
  median_change_days: number | null;
  median_change_percent: number | null;
  monthly: Array<{
    month: number;
    current: number | null;
    previous: number | null;
    current_eligible: number;
    previous_eligible: number;
  }>;
  rule: string;
}

type TimeResponse = ExtendedResponse & { comparison?: TimeComparison | null };

function signedDays(value: number | null) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${formatNumber(value)} dias`;
}

export function TimeComparisonPanel({ filters, onMonth }: Props) {
  const [data, setData] = useState<TimeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const request = useMemo(() => ({
    kpi: 4 as const,
    from: filters.from,
    to: filters.to,
    year: filters.year,
    month: filters.month,
    macro: filters.macro,
    category: filters.category,
    status: filters.status,
    sector: filters.sector,
    responsibility: filters.owner,
    q: filters.q,
    limit: 1,
  }), [filters]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchExtendedIndicator(request, controller.signal)
      .then((response) => setData(response as TimeResponse))
      .catch(() => setData(null))
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request]);

  const comparison = data?.comparison;
  if (loading && !comparison) {
    return <section className="panel comparison-panel"><span className="eyebrow">COMPARAÇÃO HOMÓLOGA</span><p>Calculando 2026 × 2025…</p></section>;
  }
  if (!comparison) return null;

  const currentYear = comparison.current.from.slice(0, 4);
  const previousYear = comparison.previous.from.slice(0, 4);
  const monthly = comparison.monthly
    .filter((item) => item.current != null || item.previous != null)
    .map((item) => ({ month: item.month, current: item.current ?? 0, previous: item.previous ?? 0 }));
  const improvement = (comparison.median_change_days ?? 0) < 0;

  return (
    <section className="panel comparison-panel kpi04-comparison" aria-label="Comparação homóloga do tempo de tramitação">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">COMPARAÇÃO HOMÓLOGA</span>
          <h2>Mediana mensal · {currentYear} × {previousYear}</h2>
          <p>Mesmo intervalo de datas nos dois anos. Quanto menor o tempo, melhor.</p>
        </div>
        <span className={`panel-chip ${improvement ? "comparison-good" : "comparison-pressure"}`}>
          {signedDays(comparison.median_change_days)} · {formatPercent(comparison.median_change_percent)}
        </span>
      </div>

      <div className="comparison-summary-grid">
        <div><small>Mediana {currentYear}</small><strong>{formatDays(comparison.current.median_days)}</strong><span>{formatNumber(comparison.current.eligible)} saídas elegíveis</span></div>
        <div><small>Mediana {previousYear}</small><strong>{formatDays(comparison.previous.median_days)}</strong><span>{formatNumber(comparison.previous.eligible)} saídas elegíveis</span></div>
        <div><small>Variação da mediana</small><strong className={improvement ? "positive" : "pressure"}>{signedDays(comparison.median_change_days)}</strong><span>{improvement ? "redução do tempo" : "aumento do tempo"}</span></div>
      </div>

      <MonthComparison
        data={monthly}
        currentYear={currentYear}
        previousYear={previousYear}
        selectedMonth={filters.month}
        onSelect={(month) => onMonth(String(month))}
      />
      <p className="comparison-rule">{comparison.rule}</p>
    </section>
  );
}
