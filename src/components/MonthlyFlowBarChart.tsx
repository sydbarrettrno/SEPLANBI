import { formatNumber, monthLabel } from "../format";
import type { FlowPoint } from "../types";

interface MonthlyFlowBarChartProps {
  data: FlowPoint[];
}

const WIDTH = 860;
const HEIGHT = 330;
const PAD = { top: 44, right: 22, bottom: 54, left: 50 };

export function MonthlyFlowBarChart({ data }: MonthlyFlowBarChartProps) {
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.received, item.concluded]));
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const groupWidth = plotWidth / Math.max(1, data.length);
  const barWidth = Math.min(30, groupWidth * 0.3);
  const gap = Math.max(5, groupWidth * 0.06);
  const y = (value: number) => PAD.top + plotHeight - (value / maxValue) * plotHeight;
  const barHeight = (value: number) => (value / maxValue) * plotHeight;

  return (
    <div className="flow-chart-wrap monthly-bars-wrap">
      <div className="chart-legend" aria-label="Legenda do gráfico">
        <span><i className="legend-received" />Entradas</span>
        <span><i className="legend-concluded" />Saídas</span>
      </div>
      <svg className="flow-chart monthly-bar-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Entradas e saídas mensais em barras agrupadas">
        {Array.from({ length: 5 }, (_, index) => {
          const lineY = PAD.top + (index / 4) * plotHeight;
          const value = Math.round(maxValue * (1 - index / 4));
          return (
            <g key={value}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={lineY} y2={lineY} className="grid-line" />
              <text x={PAD.left - 12} y={lineY + 4} textAnchor="end" className="axis-label">{formatNumber(value)}</text>
            </g>
          );
        })}
        {data.map((item, index) => {
          const center = PAD.left + groupWidth * index + groupWidth / 2;
          const receivedX = center - gap / 2 - barWidth;
          const concludedX = center + gap / 2;
          const receivedY = y(item.received);
          const concludedY = y(item.concluded);
          return (
            <g key={item.month} className="monthly-bar-group">
              <rect x={receivedX} y={receivedY} width={barWidth} height={barHeight(item.received)} rx="5" className="monthly-bar received-bar" />
              <rect x={concludedX} y={concludedY} width={barWidth} height={barHeight(item.concluded)} rx="5" className="monthly-bar concluded-bar" />
              <text x={receivedX + barWidth / 2} y={Math.max(16, receivedY - 8)} textAnchor="middle" className="bar-value received-value">{formatNumber(item.received)}</text>
              <text x={concludedX + barWidth / 2} y={Math.max(16, concludedY - 8)} textAnchor="middle" className="bar-value concluded-value">{formatNumber(item.concluded)}</text>
              <text x={center} y={HEIGHT - 18} textAnchor="middle" className="month-label">{monthLabel(item.month)}</text>
              <title>{`${monthLabel(item.month)}: ${formatNumber(item.received)} entradas e ${formatNumber(item.concluded)} saídas`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
