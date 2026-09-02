import { useState } from "react";
import { formatNumber, monthLabel } from "../format";
import type { FlowPoint } from "../types";

interface MonthlyFlowBarChartProps {
  data: FlowPoint[];
}

const WIDTH = 860;
const HEIGHT = 350;
const PAD = { top: 48, right: 22, bottom: 70, left: 50 };

export function MonthlyFlowBarChart({ data }: MonthlyFlowBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  let accumulated = 0;
  const enriched = data.map((item) => {
    accumulated += item.received - item.concluded;
    return { ...item, accumulated };
  });

  const minValue = Math.min(0, ...enriched.map((item) => item.accumulated));
  const maxValue = Math.max(
    1,
    ...enriched.flatMap((item) => [item.received, item.concluded, item.accumulated]),
  );
  const domain = Math.max(1, maxValue - minValue);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const groupWidth = plotWidth / Math.max(1, enriched.length);
  const barWidth = Math.min(30, groupWidth * 0.3);
  const gap = Math.max(5, groupWidth * 0.06);
  const y = (value: number) => PAD.top + ((maxValue - value) / domain) * plotHeight;
  const baselineY = y(0);
  const barHeight = (value: number) => Math.max(0, baselineY - y(value));
  const cumulativePoints = enriched.map((item, index) => ({
    x: PAD.left + groupWidth * index + groupWidth / 2,
    y: y(item.accumulated),
  }));
  const cumulativePath = cumulativePoints.length
    ? `M ${cumulativePoints.map((point) => `${point.x} ${point.y}`).join(" L ")}`
    : "";
  const hovered = hoveredIndex == null ? null : enriched[hoveredIndex];
  const hoveredCenter = hoveredIndex == null
    ? null
    : PAD.left + groupWidth * hoveredIndex + groupWidth / 2;

  return (
    <div className="flow-chart-wrap monthly-bars-wrap audited-flow-wrap" onMouseLeave={() => setHoveredIndex(null)}>
      <div className="chart-legend audited-flow-legend" aria-label="Legenda do gráfico">
        <span><i className="legend-received" />Entradas</span>
        <span><i className="legend-same-month" />Saídas no mês</span>
        <span><i className="legend-backlog" />Passivo</span>
        <span><i className="legend-accumulated" />Saldo acumulado</span>
      </div>
      {hovered && hoveredCenter != null ? (
        <div
          className="flow-hover-tooltip"
          style={{ left: `${(hoveredCenter / WIDTH) * 100}%` }}
          role="status"
        >
          <strong>{monthLabel(hovered.month)}</strong>
          <span><b>Entradas</b><em>{formatNumber(hovered.received)}</em></span>
          <span><b>Saídas</b><em>{formatNumber(hovered.concluded)}</em></span>
          <span><b>Saídas no mês</b><em>{formatNumber(hovered.same_month_outputs ?? hovered.concluded)}</em></span>
          <span><b>Passivo</b><em>{formatNumber(hovered.backlog_outputs ?? 0)}</em></span>
          <span className="tooltip-accumulated"><b>Saldo acumulado</b><em>{hovered.accumulated > 0 ? "+" : ""}{formatNumber(hovered.accumulated)}</em></span>
        </div>
      ) : null}
      <svg className="flow-chart monthly-bar-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Entradas mensais, saídas decompostas e saldo acumulado">
        {Array.from({ length: 5 }, (_, index) => {
          const lineY = PAD.top + (index / 4) * plotHeight;
          const value = Math.round(maxValue - (index / 4) * domain);
          return (
            <g key={`${index}-${value}`}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={lineY} y2={lineY} className="grid-line" />
              <text x={PAD.left - 12} y={lineY + 4} textAnchor="end" className="axis-label">{formatNumber(value)}</text>
            </g>
          );
        })}

        {enriched.map((item, index) => {
          const center = PAD.left + groupWidth * index + groupWidth / 2;
          const receivedX = center - gap / 2 - barWidth;
          const concludedX = center + gap / 2;
          const receivedY = y(item.received);
          const totalOutputY = y(item.concluded);
          const sameMonth = item.same_month_outputs ?? item.concluded;
          const backlog = item.backlog_outputs ?? 0;
          const sameMonthHeight = barHeight(sameMonth);
          const backlogHeight = barHeight(backlog);
          const sameMonthY = baselineY - sameMonthHeight;
          return (
            <g key={item.month} className={`monthly-bar-group ${hoveredIndex === index ? "is-hovered" : ""}`}>
              <rect x={receivedX} y={receivedY} width={barWidth} height={barHeight(item.received)} rx="5" className="monthly-bar received-bar" />
              <rect x={concludedX} y={sameMonthY} width={barWidth} height={sameMonthHeight} rx="0" className="monthly-bar same-month-output-bar" />
              {backlog > 0 ? (
                <rect x={concludedX} y={totalOutputY} width={barWidth} height={backlogHeight} rx="5" className="monthly-bar backlog-output-bar" />
              ) : null}

              <text x={receivedX + barWidth / 2} y={Math.max(16, receivedY - 8)} textAnchor="middle" className="bar-value received-value">{formatNumber(item.received)}</text>
              <text x={concludedX + barWidth / 2} y={Math.max(16, totalOutputY - 8)} textAnchor="middle" className="bar-value concluded-value">{formatNumber(item.concluded)}</text>

              {sameMonthHeight >= 24 ? (
                <text x={concludedX + barWidth / 2} y={sameMonthY + sameMonthHeight / 2 + 4} textAnchor="middle" className="flow-segment-value same-month-segment-value">{formatNumber(sameMonth)}</text>
              ) : null}
              {backlogHeight >= 24 ? (
                <text x={concludedX + barWidth / 2} y={totalOutputY + backlogHeight / 2 + 4} textAnchor="middle" className="flow-segment-value backlog-segment-value">{formatNumber(backlog)}</text>
              ) : null}

              <text x={center} y={HEIGHT - 32} textAnchor="middle" className="month-label">{monthLabel(item.month)}</text>
              <text x={center} y={HEIGHT - 14} textAnchor="middle" className={`flow-balance-label ${item.received - item.concluded < 0 ? "absorbing" : "pressure"}`}>
                {item.received - item.concluded > 0 ? "+" : ""}{formatNumber(item.received - item.concluded)}
              </text>
              <rect
                x={center - groupWidth / 2}
                y={PAD.top}
                width={groupWidth}
                height={plotHeight + 56}
                className="flow-hover-zone"
                onMouseEnter={() => setHoveredIndex(index)}
              >
                <title>{`${monthLabel(item.month)}: ${formatNumber(item.received)} entradas; ${formatNumber(item.concluded)} saídas; saldo acumulado ${formatNumber(item.accumulated)}.`}</title>
              </rect>
            </g>
          );
        })}

        {cumulativePath ? <path d={cumulativePath} className="accumulated-line" /> : null}
        {cumulativePoints.map((point, index) => (
          <circle
            key={`acc-${enriched[index]?.month ?? index}`}
            cx={point.x}
            cy={point.y}
            r="4"
            className={`accumulated-point ${hoveredIndex === index ? "is-hovered" : ""}`}
            onMouseEnter={() => setHoveredIndex(index)}
          />
        ))}
      </svg>
    </div>
  );
}
