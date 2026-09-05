import { useState } from "react";
import { constructionPermitsData, type ConstructionAnnualPoint } from "../construction";
import { formatNumber } from "../format";

const WIDTH = 960;
const HEIGHT = 390;
const PAD = { top: 46, right: 22, bottom: 70, left: 94 };

function compactArea(value: number) {
  if (value >= 1_000_000) return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value / 1_000_000)} mi m²`;
  return `${formatNumber(Math.round(value))} m²`;
}

function percent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

type CountHover = { year: number; permits: number; newConstruction: number; left: number } | null;
type AreaHover = { year: number; area: number; left: number } | null;

function CountHistoryChart({ data }: { data: readonly ConstructionAnnualPoint[] }) {
  const [hover, setHover] = useState<CountHover>(null);
  const max = Math.ceil(Math.max(...data.map((item) => item.permits)) / 400) * 400;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const group = plotWidth / data.length;
  const bar = Math.min(28, group * 0.28);
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;

  return (
    <div className="construction-chart-wrap construction-chart-with-tooltip" onMouseLeave={() => setHover(null)}>
      <div className="construction-chart-legend" aria-label="Legenda do gráfico">
        <span><i className="construction-legend-total" />Alvarás totais</span>
        <span><i className="construction-legend-new" />Construção nova</span>
      </div>
      {hover ? (
        <div className="construction-hover-tooltip" style={{ left: `${hover.left}%` }} role="status">
          <strong>{hover.year}</strong>
          <span><i className="construction-legend-total" /><b>Alvarás totais</b><em>{formatNumber(hover.permits)} un.</em></span>
          <span><i className="construction-legend-new" /><b>Construção nova</b><em>{formatNumber(hover.newConstruction)} un.</em></span>
        </div>
      ) : null}
      <svg className="construction-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Alvarás emitidos no período por ano">
        {Array.from({ length: 5 }, (_, index) => {
          const value = Math.round(max - (index / 4) * max);
          const lineY = PAD.top + (index / 4) * plotHeight;
          return <g key={value}><line x1={PAD.left} x2={WIDTH - PAD.right} y1={lineY} y2={lineY} className="construction-grid-line" /><text x={PAD.left - 12} y={lineY + 4} textAnchor="end" className="construction-axis-label">{formatNumber(value)}</text></g>;
        })}
        <text x={22} y={PAD.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 22 ${PAD.top + plotHeight / 2})`} className="construction-axis-title">Alvarás emitidos no período (un.)</text>
        <text x={PAD.left + plotWidth / 2} y={HEIGHT - 8} textAnchor="middle" className="construction-axis-title">Ano de emissão</text>
        {data.map((item, index) => {
          const center = PAD.left + group * index + group / 2;
          const totalX = center - bar - 3;
          const newX = center + 3;
          const totalY = y(item.permits);
          const newY = y(item.newConstruction);
          const activate = () => setHover({ year: item.year, permits: item.permits, newConstruction: item.newConstruction, left: (center / WIDTH) * 100 });
          return (
            <g key={item.year} onMouseEnter={activate}>
              <rect x={totalX} y={totalY} width={bar} height={PAD.top + plotHeight - totalY} rx="4" className="construction-bar-total" />
              <rect x={newX} y={newY} width={bar} height={PAD.top + plotHeight - newY} rx="4" className="construction-bar-new" />
              <text x={totalX + bar / 2} y={Math.max(16, totalY - 7)} textAnchor="middle" className="construction-bar-value construction-bar-value-total">{formatNumber(item.permits)}</text>
              <text x={newX + bar / 2} y={Math.max(16, newY - 7)} textAnchor="middle" className="construction-bar-value construction-bar-value-new">{formatNumber(item.newConstruction)}</text>
              <text x={center} y={HEIGHT - 32} textAnchor="middle" className="construction-year-label">{item.year}</text>
              <rect x={center - group / 2} y={PAD.top} width={group} height={plotHeight + 32} className="construction-hover-zone" onMouseEnter={activate} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AreaHistoryChart({ data }: { data: readonly ConstructionAnnualPoint[] }) {
  const [hover, setHover] = useState<AreaHover>(null);
  const max = Math.ceil(Math.max(...data.map((item) => item.authorizedAreaM2)) / 50_000) * 50_000;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const group = plotWidth / data.length;
  const bar = Math.min(48, group * 0.55);
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;

  return (
    <div className="construction-chart-wrap construction-chart-with-tooltip" onMouseLeave={() => setHover(null)}>
      <div className="construction-chart-legend"><span><i className="construction-legend-area" />Área autorizada</span></div>
      {hover ? (
        <div className="construction-hover-tooltip" style={{ left: `${hover.left}%` }} role="status">
          <strong>{hover.year}</strong>
          <span><i className="construction-legend-area" /><b>Área autorizada</b><em>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(hover.area)} m²</em></span>
        </div>
      ) : null}
      <svg className="construction-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Área autorizada para construção nova por ano">
        {Array.from({ length: 5 }, (_, index) => {
          const value = Math.round(max - (index / 4) * max);
          const lineY = PAD.top + (index / 4) * plotHeight;
          return <g key={value}><line x1={PAD.left} x2={WIDTH - PAD.right} y1={lineY} y2={lineY} className="construction-grid-line" /><text x={PAD.left - 12} y={lineY + 4} textAnchor="end" className="construction-axis-label">{value === 0 ? "0" : `${formatNumber(Math.round(value / 1000))} mil`}</text></g>;
        })}
        <text x={22} y={PAD.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 22 ${PAD.top + plotHeight / 2})`} className="construction-axis-title">Área autorizada para construção nova (m²)</text>
        <text x={PAD.left + plotWidth / 2} y={HEIGHT - 8} textAnchor="middle" className="construction-axis-title">Ano de emissão</text>
        {data.map((item, index) => {
          const center = PAD.left + group * index + group / 2;
          const barY = y(item.authorizedAreaM2);
          const activate = () => setHover({ year: item.year, area: item.authorizedAreaM2, left: (center / WIDTH) * 100 });
          return (
            <g key={item.year} onMouseEnter={activate}>
              <rect x={center - bar / 2} y={barY} width={bar} height={PAD.top + plotHeight - barY} rx="5" className="construction-area-bar" />
              <text x={center} y={Math.max(16, barY - 7)} textAnchor="middle" className="construction-bar-value construction-area-value">{formatNumber(Math.round(item.authorizedAreaM2))}</text>
              <text x={center} y={HEIGHT - 32} textAnchor="middle" className="construction-year-label">{item.year}</text>
              <rect x={center - group / 2} y={PAD.top} width={group} height={plotHeight + 32} className="construction-hover-zone" onMouseEnter={activate} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const COMPOSITION = [
  { key: "multifamily", label: "Residencial multifamiliar", className: "composition-multifamily" },
  { key: "residentialUnspecified", label: "Residencial unifamiliar", className: "composition-residential" },
  { key: "commercialServices", label: "Comercial / serviços", className: "composition-commercial" },
  { key: "industrial", label: "Industrial", className: "composition-industrial" },
  { key: "other", label: "Outros", className: "composition-other" },
] as const;

type CompositionKey = (typeof COMPOSITION)[number]["key"];
type CompositionHover = { year: number; label: string; value: number; share: number; className: string } | null;

function CompositionChart({ data }: { data: readonly ConstructionAnnualPoint[] }) {
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [hover, setHover] = useState<CompositionHover>(null);
  const visibleData = showFullHistory ? data : data.slice(-5);

  return (
    <div className="construction-composition construction-composition-interactive" onMouseLeave={() => setHover(null)}>
      <div className="construction-composition-toolbar">
        <div className="construction-composition-toolbar-main">
          <div className="construction-composition-legend" aria-label="Segmentação por uso">
            {COMPOSITION.map((item) => <span key={item.key}><i className={item.className} />{item.label}</span>)}
          </div>
          <span className="construction-segmentation-hint">Passe o mouse sobre cada faixa para ver quantidade e participação.</span>
        </div>
        <div className="construction-period-switch" role="group" aria-label="Período da composição por uso">
          <button type="button" aria-pressed={!showFullHistory} className={!showFullHistory ? "active" : ""} onClick={() => setShowFullHistory(false)}>2021–2025</button>
          <button type="button" aria-pressed={showFullHistory} className={showFullHistory ? "active" : ""} onClick={() => setShowFullHistory(true)}>2016–2025</button>
        </div>
      </div>

      {hover ? (
        <div className="construction-composition-hover" role="status">
          <strong>{hover.year}</strong>
          <span><i className={hover.className} /><b>{hover.label}</b><em>{formatNumber(hover.value)} un. · {percent(hover.share)}</em></span>
        </div>
      ) : null}

      <div className="construction-composition-grid">
        {visibleData.map((row) => (
          <div className="construction-composition-row" key={row.year}>
            <strong>{row.year}</strong>
            <div className="construction-composition-track" aria-label={`Composição de ${row.year}`}>
              {COMPOSITION.map((item) => {
                const value = row[item.key];
                const share = row.newConstruction ? (value / row.newConstruction) * 100 : 0;
                return (
                  <span
                    key={item.key}
                    className={`${item.className} construction-composition-segment`}
                    style={{ width: `${share}%` }}
                    onMouseEnter={() => setHover({ year: row.year, label: item.label, value, share, className: item.className })}
                  >
                    {share >= 6.5 ? <b>{formatNumber(value)}</b> : null}
                  </span>
                );
              })}
            </div>
            <span className="construction-composition-total">{formatNumber(row.newConstruction)}</span>
          </div>
        ))}
      </div>
      <div className="construction-composition-axis"><span>Uso da construção nova</span><strong>Quantidade de alvarás (un.)</strong></div>
    </div>
  );
}

export function ConstructionPermitsPanel() {
  const { totals, annual, currentYtd, ytdComparison } = constructionPermitsData;
  const [historyMetric, setHistoryMetric] = useState<"permits" | "area">("permits");

  return (
    <section className="construction-page construction-executive-only">
      <section className="panel construction-ytd-section construction-ytd-priority">
        <div className="panel-heading construction-panel-heading">
          <div><span className="eyebrow">Cenário atual</span><h2>2026 até 03/09 × mesmo período de 2025</h2><p>Comparação no mesmo recorte de datas para evitar distorção do ano parcial.</p></div>
          <span className="panel-chip construction-ytd-chip">2026 parcial · {formatNumber(currentYtd.permits)} alvarás</span>
        </div>
        <div className="construction-ytd-grid">
          {ytdComparison.map((item) => (
            <article key={item.label} className={item.label === "Área autorizada" ? "construction-ytd-highlight" : ""}>
              <span>{item.label}{item.unit === "count" ? " (un.)" : " (m²)"}</span>
              <em>{item.changePercent >= 0 ? "+" : ""}{percent(item.changePercent)}</em>
              <div><strong>{item.unit === "m2" ? compactArea(item.previous) : formatNumber(item.previous)}</strong><b>→</b><strong>{item.unit === "m2" ? compactArea(item.current) : formatNumber(item.current)}</strong></div>
              <small>01/01–03/09/2025 → 01/01–03/09/2026</small>
            </article>
          ))}
        </div>
      </section>

      <section className="construction-kpi-section" aria-labelledby="construction-historical-title">
        <div className="construction-section-heading">
          <div><span className="eyebrow">Panorama consolidado</span><h2 id="construction-historical-title">Dez anos completos · 2016–2025</h2></div>
          <p>Referência histórica separada do ano parcial de 2026.</p>
        </div>
        <div className="kpi-grid construction-kpi-grid" aria-label="Indicadores históricos da construção civil">
          <article className="kpi-card tone-blue construction-kpi-card"><span className="kpi-accent" /><div className="kpi-topline"><span>ALVARÁS EMITIDOS (un.)</span></div><strong>{formatNumber(totals.permits)}</strong><p>Todos os tipos emitidos no período.</p><footer><span>2016–2025</span></footer></article>
          <article className="kpi-card tone-blue construction-kpi-card"><span className="kpi-accent" /><div className="kpi-topline"><span>CONSTRUÇÃO NOVA (un.)</span></div><strong>{formatNumber(totals.newConstruction)}</strong><p>Alvarás classificados como construção nova.</p><footer><span>2016–2025</span></footer></article>
          <article className="kpi-card tone-green construction-kpi-card"><span className="kpi-accent" /><div className="kpi-topline"><span>ÁREA AUTORIZADA (m²)</span></div><strong>{compactArea(totals.authorizedAreaM2)}</strong><p>Somente área vinculada à construção nova.</p><footer><span>2016–2025</span></footer></article>
          <article className="kpi-card tone-purple construction-kpi-card"><span className="kpi-accent" /><div className="kpi-topline"><span>MEDIANA DE ÁREA (m²)</span></div><strong>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(totals.medianAreaM2)} m²</strong><p>Porte central das construções novas.</p><footer><span>2016–2025</span></footer></article>
        </div>
      </section>

      <article className="panel construction-panel construction-history-panel">
        <div className="panel-heading construction-panel-heading">
          <div><span className="eyebrow">Evolução anual</span><h2>{historyMetric === "permits" ? "Alvarás emitidos no período (un.)" : "Área autorizada para construção nova (m²)"} · 2016–2025</h2><p>{historyMetric === "permits" ? "Total anual e parcela correspondente a construção nova." : "Metragem física autorizada em cada ano."}</p></div>
          <div className="construction-metric-switch" role="group" aria-label="Indicador do histórico anual">
            <button type="button" aria-pressed={historyMetric === "permits"} className={historyMetric === "permits" ? "active" : ""} onClick={() => setHistoryMetric("permits")}>Alvarás (un.)</button>
            <button type="button" aria-pressed={historyMetric === "area"} className={historyMetric === "area" ? "active" : ""} onClick={() => setHistoryMetric("area")}>Área (m²)</button>
          </div>
        </div>
        {historyMetric === "permits" ? <CountHistoryChart data={annual} /> : <AreaHistoryChart data={annual} />}
      </article>

      <article className="panel construction-panel construction-composition-panel">
        <div className="panel-heading construction-panel-heading"><div><span className="eyebrow">Perfil das autorizações</span><h2>Composição da construção nova por uso · alvarás (un.)</h2><p>Participação anual dos usos normalizados dentro dos alvarás classificados como construção nova.</p></div></div>
        <CompositionChart data={annual} />
      </article>

      <section className="construction-reading-note">
        <div className="management-note"><strong>Normalização</strong><p>“Residencial” é tratado como residencial unifamiliar. Na relação analítica, registros que combinam residencial e comercial são classificados como misto residencial/comercial.</p></div>
        <div className="management-note"><strong>Leitura dos dados</strong><p>Alvará é autorização administrativa. O CA estimado é calculado na relação analítica protegida a partir do cruzamento com o Cadastro Imobiliário.</p></div>
      </section>
    </section>
  );
}
