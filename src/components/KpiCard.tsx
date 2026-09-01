import { useId } from "react";

export interface KpiSeriesPoint {
  label: string;
  value: number | null;
}

export interface KpiTooltipContent {
  what: string;
  interpret: string;
  period: string;
}

interface KpiCardProps {
  eyebrow: string;
  value: string;
  description: string;
  detail: string;
  tone: "blue" | "green" | "orange" | "purple" | "red";
  trend?: string;
  icon?: string;
  series?: KpiSeriesPoint[];
  tooltip?: KpiTooltipContent;
  onClick?: () => void;
}

function Sparkline({ series }: { series: KpiSeriesPoint[] }) {
  const values = series.filter((point): point is KpiSeriesPoint & { value: number } =>
    typeof point.value === "number" && Number.isFinite(point.value),
  );
  if (values.length < 2) return <div className="kpi-sparkline kpi-sparkline-empty" aria-hidden="true" />;

  const width = 220;
  const height = 44;
  const pad = 3;
  const min = Math.min(...values.map((point) => point.value));
  const max = Math.max(...values.map((point) => point.value));
  const range = Math.max(1, max - min);
  const x = (index: number) => pad + (index / (values.length - 1)) * (width - pad * 2);
  const y = (value: number) => pad + (1 - (value - min) / range) * (height - pad * 2);
  const points = values.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const firstX = x(0);
  const lastX = x(values.length - 1);
  const area = `M ${firstX} ${height - pad} L ${values
    .map((point, index) => `${x(index)} ${y(point.value)}`)
    .join(" L ")} L ${lastX} ${height - pad} Z`;

  return (
    <div className="kpi-sparkline" aria-label="Evolução do indicador no período">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <path className="kpi-spark-area" d={area} />
        <polyline className="kpi-spark-line" points={points} />
        {values.map((point, index) => (
          <circle key={`${point.label}-${index}`} className="kpi-spark-point" cx={x(index)} cy={y(point.value)} r="2.3">
            <title>{`${point.label}: ${point.value.toLocaleString("pt-BR")}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export function KpiCard({ eyebrow, value, description, detail, tone, trend, icon, series = [], tooltip, onClick }: KpiCardProps) {
  const tooltipId = useId();
  return (
    <button
      className={`kpi-card tone-${tone}`}
      onClick={onClick}
      type="button"
      aria-label={`${eyebrow}: ${value}. ${description}`}
      aria-describedby={tooltip ? tooltipId : undefined}
    >
      <span className="kpi-accent" />
      <div className="kpi-topline">
        <span className="kpi-label">{icon ? <i aria-hidden="true">{icon}</i> : null}{eyebrow}</span>
        <span className="kpi-topline-side">
          {trend ? <small>{trend}</small> : null}
          {tooltip ? <i className="kpi-help" aria-hidden="true">?</i> : null}
        </span>
      </div>
      <strong>{value}</strong>
      <p>{description}</p>
      <Sparkline series={series} />
      <footer>
        <span>{detail}</span>
        <i aria-hidden="true">→</i>
      </footer>
      {tooltip ? (
        <span className="kpi-help-tooltip" role="tooltip" id={tooltipId}>
          <span><b>O que é</b>{tooltip.what}</span>
          <span><b>Como interpretar</b>{tooltip.interpret}</span>
          <span><b>Período analisado</b>{tooltip.period}</span>
        </span>
      ) : null}
    </button>
  );
}
