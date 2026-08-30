import { useState } from "react";
import { formatNumber, formatPercent } from "../format";

export interface VisualItem {
  key: string;
  label: string;
  value: number;
  context?: string;
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
      <div className="bi-legend"><span><i className="current" />{currentYear}</span><span><i className="previous" />{previousYear}</span></div>
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

export function StackedComposition({ items, selected, onSelect }: CompositionProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <div className="bi-empty">Sem estoque no recorte.</div>;
  return (
    <div className="stacked-composition">
      <div className="stacked-track">
        {items.map((item, index) => (
          <button
            type="button"
            data-visual-key={item.key}
            data-visual-value={item.value}
            key={item.key}
            className={`segment segment-${index + 1} ${selected === item.key ? "selected" : ""}`}
            style={{ width: `${item.value / total * 100}%` }}
            onClick={() => onSelect(item)}
            title={`${item.label}: ${formatNumber(item.value)} (${formatPercent(item.value / total * 100)}). Clique para cruzar os demais gráficos.`}
          >
            <span>{formatNumber(item.value)}</span>
          </button>
        ))}
      </div>
      <div className="composition-legend">
        {items.map((item, index) => <span key={item.key}><i className={`segment-${index + 1}`} />{item.label}<strong>{formatPercent(item.value / total * 100)}</strong></span>)}
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
