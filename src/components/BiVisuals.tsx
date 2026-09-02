import { useState, type CSSProperties } from "react";
import { formatNumber, formatPercent } from "../format";

export interface VisualItem {
  key: string;
  label: string;
  value: number;
  context?: string;
  color?: string;
}

interface InteractiveBarsProps {
  items: VisualItem[];
  onSelect: (item: VisualItem) => void;
  selected?: string;
  tone?: "blue" | "green" | "orange" | "teal" | "red";
  initialLimit?: number;
  emptyLabel?: string;
}

export function InteractiveBars({ items, onSelect, selected, tone = "blue", initialLimit = 8, emptyLabel = "Sem dados para o recorte." }: InteractiveBarsProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialLimit);
  const max = Math.max(1, ...visible.map((item) => item.value));
  if (!items.length) return <div className="bi-empty">{emptyLabel}</div>;
  return (
    <div className={`interactive-bars bars-${tone}`}>
      {visible.map((item) => (
        <button
          type="button"
          data-visual-key={item.key}
          data-visual-value={item.value}
          style={item.color ? ({ "--item-color": item.color } as CSSProperties) : undefined}
          className={selected === item.key ? "selected" : ""}
          key={item.key}
          onClick={() => onSelect(item)}
          title={`${item.label}: ${formatNumber(item.value)} protocolos${item.context ? `. ${item.context}` : ""}. Clique para filtrar os demais gráficos.`}
        >
          <span><strong>{item.label}</strong><b>{formatNumber(item.value)}</b></span>
          <i><em style={{ width: `${(item.value / max) * 100}%` }} /></i>
        </button>
      ))}
      {items.length > initialLimit ? (
        <button type="button" className="expand-bars" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Mostrar principais" : `Ver todas (${items.length})`}
        </button>
      ) : null}
    </div>
  );
}

interface MonthComparisonProps {
  data: Array<{ month: number; current: number; previous: number }>;
  currentYear: string;
  previousYear: string;
  selectedMonth?: string;
  onSelect: (month: number) => void;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function MonthComparison({ data, currentYear, previousYear, selectedMonth, onSelect }: MonthComparisonProps) {
  const max = Math.max(1, ...data.flatMap((item) => [item.current, item.previous]));
  if (!data.length) return <div className="bi-empty">Sem série mensal para o recorte.</div>;
  return (
    <div className="month-comparison" role="group" aria-label={`Comparação mensal ${currentYear} e ${previousYear}`}>
      <div className="bi-legend"><span><i className="current" />{currentYear} · atual</span><span><i className="previous" />{previousYear} · comparação</span></div>
      <div className="month-columns">
        {data.map((item) => (
          <button
            type="button"
            data-month={item.month}
            data-current-value={item.current}
            data-previous-value={item.previous}
            key={item.month}
            className={selectedMonth === String(item.month) ? "selected" : ""}
            onClick={() => onSelect(item.month)}
            title={`${MONTHS[item.month - 1]}: ${formatNumber(item.current)} em ${currentYear}; ${formatNumber(item.previous)} em ${previousYear}. Clique para detalhar o mês.`}
          >
            <span className="month-values"><small>{formatNumber(item.current)}</small><small>{formatNumber(item.previous)}</small></span>
            <span className="month-bars">
              <i className="current" style={{ height: `${Math.max(3, item.current / max * 100)}%` }} />
              <i className="previous" style={{ height: `${Math.max(3, item.previous / max * 100)}%` }} />
            </span>
            <strong>{MONTHS[item.month - 1]}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

interface MonthlyFlowProps {
  data: Array<{ month: string; received: number; outputs: number; balance: number }>;
  selectedMonth?: string;
  onSelect: (month: number) => void;
}

export function MonthlyFlow({ data, selectedMonth, onSelect }: MonthlyFlowProps) {
  const max = Math.max(1, ...data.flatMap((item) => [item.received, item.outputs]));
  if (!data.length) return <div className="bi-empty">Sem série mensal para o recorte.</div>;
  return (
    <div className="monthly-flow">
      <div className="bi-legend"><span><i className="received" />Recebidos</span><span><i className="outputs" />Saídas</span></div>
      <div className="flow-columns">
        {data.map((item) => {
          const month = Number(item.month.slice(5, 7));
          return (
            <button
              type="button"
              data-month={month}
              data-received-value={item.received}
              data-output-value={item.outputs}
              data-balance-value={item.balance}
              key={item.month}
              className={selectedMonth === String(month) ? "selected" : ""}
              onClick={() => onSelect(month)}
              title={`${MONTHS[month - 1]}: ${formatNumber(item.received)} recebidos, ${formatNumber(item.outputs)} saídas, saldo ${item.balance > 0 ? "+" : ""}${formatNumber(item.balance)}. ${item.balance > 0 ? "O estoque cresceu." : item.balance < 0 ? "O estoque foi reduzido." : "Fluxo equilibrado."}`}
            >
              <span className="month-values" aria-label={`${formatNumber(item.received)} recebidos e ${formatNumber(item.outputs)} saídas`}>
                <small>{formatNumber(item.received)}</small>
                <small style={{ color: "var(--green)", fontWeight: 800 }}>{formatNumber(item.outputs)}</small>
              </span>
              <span className="flow-bars-pair">
                <i className="received" style={{ height: `${Math.max(3, item.received / max * 100)}%` }} />
                <i className="outputs" style={{ height: `${Math.max(3, item.outputs / max * 100)}%` }} />
              </span>
              <strong>{MONTHS[month - 1]}</strong>
              <small className={item.balance > 0 ? "positive-stock" : item.balance < 0 ? "negative-stock" : ""}>{item.balance > 0 ? "+" : ""}{formatNumber(item.balance)}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BalanceEvolution({ data, selectedMonth, onSelect }: MonthlyFlowProps) {
  const max = Math.max(1, ...data.map((item) => Math.abs(item.balance)));
  if (!data.length) return <div className="bi-empty">Sem saldo mensal para o recorte.</div>;
  return (
    <div className="balance-evolution">
      {data.map((item) => {
        const month = Number(item.month.slice(5, 7));
        const positive = item.balance >= 0;
        return (
          <button
            type="button"
            data-month={month}
            data-balance-value={item.balance}
            key={item.month}
            className={`${positive ? "stock-growth" : "stock-reduction"} ${selectedMonth === String(month) ? "selected" : ""}`}
            onClick={() => onSelect(month)}
            title={`${MONTHS[month - 1]}: saldo ${item.balance > 0 ? "+" : ""}${formatNumber(item.balance)}. ${positive ? "Positivo = aumento do estoque." : "Negativo = redução do estoque."}`}
          >
            <span>{MONTHS[month - 1]}</span>
            <i><em style={{ width: `${Math.abs(item.balance) / max * 100}%` }} /></i>
            <strong>{item.balance > 0 ? "+" : ""}{formatNumber(item.balance)}</strong>
          </button>
        );
      })}
    </div>
  );
}

interface CompositionProps {
  items: VisualItem[];
  selected?: string;
  onSelect: (item: VisualItem) => void;
}

const PIE_COLORS = ["#1871d5", "#63728b", "#c63f47", "#16805f", "#7660c9"];

function ellipsePoint(cx: number, cy: number, rx: number, ry: number, angle: number) {
  const rad = (angle - 90) * Math.PI / 180;
  return { x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) };
}

function pieSlicePath(cx: number, cy: number, rx: number, ry: number, startAngle: number, endAngle: number) {
  const start = ellipsePoint(cx, cy, rx, ry, endAngle);
  const end = ellipsePoint(cx, cy, rx, ry, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${rx} ${ry} 0 ${largeArcFlag} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)} Z`;
}

export function StackedComposition({ items, selected, onSelect }: CompositionProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <div className="bi-empty">Sem estoque no recorte.</div>;

  let cursor = 0;
  const slices = items.map((item, index) => {
    const startAngle = cursor / total * 360;
    cursor += item.value;
    const endAngle = cursor / total * 360;
    const color = item.color || PIE_COLORS[index % PIE_COLORS.length];
    return { item, startAngle, endAngle, color, percent: item.value / total * 100 };
  });

  const cx = 180;
  const cy = 94;
  const rx = 126;
  const ry = 70;
  const depthLayers = [20, 16, 12, 8, 4];

  return (
    <div className="stacked-composition stacked-composition-chart">
      <div style={{ minWidth: 0 }}>
        <svg viewBox="0 0 360 220" role="img" aria-label={`Responsabilidade operacional de ${formatNumber(total)} protocolos`} style={{ width: "100%", minHeight: 250, overflow: "visible" }}>
          <ellipse cx={cx} cy={cy + 22} rx={rx + 7} ry={ry + 7} fill="rgba(17,43,75,.10)" />
          {depthLayers.map((depth) => (
            <g key={`depth-${depth}`} transform={`translate(0 ${depth})`} opacity={0.36} style={{ filter: "brightness(.58) saturate(.9)" }}>
              {slices.map(({ item, startAngle, endAngle, color }) => (
                <path key={`${item.key}-${depth}`} d={pieSlicePath(cx, cy, rx, ry, startAngle, endAngle)} fill={color} />
              ))}
            </g>
          ))}
          {slices.map(({ item, startAngle, endAngle, color, percent }) => {
            const mid = (startAngle + endAngle) / 2;
            const labelPoint = ellipsePoint(cx, cy, rx * .58, ry * .58, mid);
            const isSelected = selected === item.key;
            return (
              <g key={item.key}>
                <path
                  d={pieSlicePath(cx, cy, rx, ry, startAngle, endAngle)}
                  fill={color}
                  stroke={isSelected ? "#102943" : "rgba(255,255,255,.94)"}
                  strokeWidth={isSelected ? 4 : 2}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.label}: ${formatNumber(item.value)} protocolos, ${formatPercent(percent)}`}
                  onClick={() => onSelect(item)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(item); }}
                  style={{ cursor: "pointer", transition: "filter 160ms ease", filter: isSelected ? "brightness(1.08)" : undefined }}
                >
                  <title>{`${item.label}: ${formatNumber(item.value)} (${formatPercent(percent)}). Clique para filtrar.`}</title>
                </path>
                {percent >= 7 ? (
                  <text x={labelPoint.x} y={labelPoint.y + 4} textAnchor="middle" fill="white" fontSize="15" fontWeight="900" pointerEvents="none" style={{ textShadow: "0 1px 3px rgba(0,0,0,.28)" }}>
                    {formatNumber(item.value)}
                  </text>
                ) : null}
              </g>
            );
          })}
          <text x={cx} y="205" textAnchor="middle" fill="#17243f" fontSize="12" fontWeight="800">Total: {formatNumber(total)} protocolos</text>
        </svg>
      </div>

      <div className="composition-legend" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        {slices.map(({ item, color, percent }) => (
          <button
            type="button"
            key={item.key}
            data-visual-key={item.key}
            data-visual-value={item.value}
            onClick={() => onSelect(item)}
            style={{ display: "grid", gridTemplateColumns: "14px 1fr auto", alignItems: "center", gap: 10, width: "100%", padding: "11px 12px", border: selected === item.key ? "1px solid #8eb9df" : "1px solid #e0e7ef", borderRadius: 10, background: selected === item.key ? "#f2f8ff" : "#fff", color: "#46566d", textAlign: "left" }}
            title={`${item.label}: ${formatNumber(item.value)} protocolos (${formatPercent(percent)})`}
          >
            <i style={{ width: 12, height: 12, borderRadius: 4, background: color }} />
            <span style={{ display: "grid", gap: 2 }}><strong style={{ fontSize: 12 }}>{item.label}</strong><small style={{ color: "#7a8799", fontSize: 10 }}>{formatPercent(percent)} do estoque</small></span>
            <strong style={{ color: "#17243f", fontSize: 16 }}>{formatNumber(item.value)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MetricTile({ label, value, detail, tone = "blue" }: { label: string; value: string; detail?: string; tone?: string }) {
  return (
    <article className={`bi-metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}
