import { monthLabel, formatNumber } from "../format";
import type { FlowPoint } from "../types";

interface FlowChartProps {
  data: FlowPoint[];
  focus?: "received" | "concluded" | "all";
}

const WIDTH = 860;
const HEIGHT = 300;
const PAD = { top: 24, right: 24, bottom: 48, left: 48 };

function linePath(values: number[], maxValue: number) {
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  return values
    .map((value, index) => {
      const x = PAD.left + (values.length === 1 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth);
      const y = PAD.top + plotHeight - (value / maxValue) * plotHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function FlowChart({ data, focus = "all" }: FlowChartProps) {
  const allValues = data.flatMap((item) => [item.received, item.concluded, item.concluded_formal]);
  const maxValue = Math.max(1, ...allValues);
  const ySteps = 4;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const plotWidth = WIDTH - PAD.left - PAD.right;

  return (
    <div className="flow-chart-wrap">
      <div className="chart-legend" aria-label="Legenda do gráfico">
        <span><i className="legend-received" />Recebidos</span>
        <span><i className="legend-concluded" />Concluídos</span>
        <span><i className="legend-formal" />Encerrados formais</span>
      </div>
      <svg className="flow-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Fluxo mensal de protocolos">
        {Array.from({ length: ySteps + 1 }, (_, index) => {
          const y = PAD.top + (index / ySteps) * plotHeight;
          const value = Math.round(maxValue * (1 - index / ySteps));
          return (
            <g key={value}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="grid-line" />
              <text x={PAD.left - 12} y={y + 4} textAnchor="end" className="axis-label">{formatNumber(value)}</text>
            </g>
          );
        })}
        {data.map((item, index) => {
          const x = PAD.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
          return <text key={item.month} x={x} y={HEIGHT - 16} textAnchor="middle" className="month-label">{monthLabel(item.month)}</text>;
        })}
        <path d={linePath(data.map((item) => item.received), maxValue)} className={`line received-line ${focus === "concluded" ? "line-muted" : ""}`} />
        <path d={linePath(data.map((item) => item.concluded), maxValue)} className={`line concluded-line ${focus === "received" ? "line-muted" : ""}`} />
        <path d={linePath(data.map((item) => item.concluded_formal), maxValue)} className={`line formal-line ${focus !== "concluded" && focus !== "all" ? "line-muted" : ""}`} />
        {data.map((item, index) => {
          const x = PAD.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
          const y = PAD.top + plotHeight - (item.received / maxValue) * plotHeight;
          return (
            <g key={`point-${item.month}`} className="chart-point">
              <circle cx={x} cy={y} r="5" />
              <title>{`${monthLabel(item.month)}: ${formatNumber(item.received)} recebidos, ${formatNumber(item.concluded)} concluídos`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
