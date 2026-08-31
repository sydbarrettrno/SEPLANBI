import { formatNumber, monthLabel } from "../format";
import type { FlowPoint } from "../types";

interface MonthlyFlowBarChartProps {
  data: FlowPoint[];
}

const WIDTH = 860;
const HEIGHT = 350;
const PAD = { top: 48, right: 22, bottom: 70, left: 50 };

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
    <div className="flow-chart-wrap monthly-bars-wrap audited-flow-wrap">
      <div className="chart-legend audited-flow-legend" aria-label="Legenda do gráfico">
        <span><i className="legend-received" />Entradas</span>
        <span><i className="legend-same-month" />Saídas · abertas no mês</span>
        <span><i className="legend-backlog" />Saídas · passivo anterior</span>
      </div>
      <svg className="flow-chart monthly-bar-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Entradas mensais e saídas separadas entre protocolos abertos no próprio mês e passivo anterior">
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
          const totalOutputY = y(item.concluded);
          const sameMonth = item.same_month_outputs ?? item.concluded;
          const backlog = item.backlog_outputs ?? 0;
          const sameMonthHeight = barHeight(sameMonth);
          const backlogHeight = barHeight(backlog);
          const sameMonthY = PAD.top + plotHeight - sameMonthHeight;
          return (
            <g key={item.month} className="monthly-bar-group">
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
              <title>{`${monthLabel(item.month)}: ${formatNumber(item.received)} entradas; ${formatNumber(item.concluded)} saídas = ${formatNumber(sameMonth)} abertas e concluídas no mês + ${formatNumber(backlog)} do passivo anterior.`}</title>
            </g>
          );
        })}
      </svg>
      <p className="flow-audit-note"><strong>Como ler:</strong> a saída pertence ao mês em que o processo foi concluído. A barra de saídas separa o que entrou e saiu no próprio mês do passivo aberto anteriormente.</p>
    </div>
  );
}
