import { useState } from "react";
import { constructionPermitsData, type ConstructionAnnualPoint } from "../construction";
import { formatDate, formatNumber } from "../format";

const WIDTH = 960;
const HEIGHT = 360;
const PAD = { top: 40, right: 18, bottom: 48, left: 58 };

function compactArea(value: number) {
  if (value >= 1_000_000) return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value / 1_000_000)} mi m²`;
  return `${formatNumber(Math.round(value))} m²`;
}

function percent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

function CountHistoryChart({ data }: { data: readonly ConstructionAnnualPoint[] }) {
  const max = Math.ceil(Math.max(...data.map((item) => item.permits)) / 400) * 400;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const group = plotWidth / data.length;
  const bar = Math.min(28, group * 0.28);
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;

  return (
    <div className="construction-chart-wrap">
      <div className="construction-chart-legend"><span><i className="construction-legend-total" />Alvarás totais</span><span><i className="construction-legend-new" />Construção nova</span></div>
      <svg className="construction-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Evolução anual dos alvarás totais e de construção nova de 2016 a 2025">
        {Array.from({ length: 5 }, (_, index) => {
          const value = Math.round(max - (index / 4) * max);
          const lineY = PAD.top + (index / 4) * plotHeight;
          return <g key={value}><line x1={PAD.left} x2={WIDTH - PAD.right} y1={lineY} y2={lineY} className="construction-grid-line" /><text x={PAD.left - 12} y={lineY + 4} textAnchor="end" className="construction-axis-label">{formatNumber(value)}</text></g>;
        })}
        {data.map((item, index) => {
          const center = PAD.left + group * index + group / 2;
          const totalX = center - bar - 3;
          const newX = center + 3;
          const totalY = y(item.permits);
          const newY = y(item.newConstruction);
          return (
            <g key={item.year}>
              <rect x={totalX} y={totalY} width={bar} height={PAD.top + plotHeight - totalY} rx="4" className="construction-bar-total"><title>{`${item.year}: ${formatNumber(item.permits)} alvarás totais`}</title></rect>
              <rect x={newX} y={newY} width={bar} height={PAD.top + plotHeight - newY} rx="4" className="construction-bar-new"><title>{`${item.year}: ${formatNumber(item.newConstruction)} de construção nova`}</title></rect>
              <text x={totalX + bar / 2} y={Math.max(13, totalY - 7)} textAnchor="middle" className="construction-bar-value construction-bar-value-total">{formatNumber(item.permits)}</text>
              <text x={newX + bar / 2} y={Math.max(13, newY - 7)} textAnchor="middle" className="construction-bar-value construction-bar-value-new">{formatNumber(item.newConstruction)}</text>
              <text x={center} y={HEIGHT - 18} textAnchor="middle" className="construction-year-label">{item.year}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AreaHistoryChart({ data }: { data: readonly ConstructionAnnualPoint[] }) {
  const max = Math.ceil(Math.max(...data.map((item) => item.authorizedAreaM2)) / 50_000) * 50_000;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const group = plotWidth / data.length;
  const bar = Math.min(48, group * 0.55);
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;

  return (
    <div className="construction-chart-wrap">
      <svg className="construction-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Área autorizada para construção nova por ano de 2016 a 2025">
        {Array.from({ length: 5 }, (_, index) => {
          const value = Math.round(max - (index / 4) * max);
          const lineY = PAD.top + (index / 4) * plotHeight;
          return <g key={value}><line x1={PAD.left} x2={WIDTH - PAD.right} y1={lineY} y2={lineY} className="construction-grid-line" /><text x={PAD.left - 12} y={lineY + 4} textAnchor="end" className="construction-axis-label">{value === 0 ? "0" : `${formatNumber(Math.round(value / 1000))} mil`}</text></g>;
        })}
        {data.map((item, index) => {
          const center = PAD.left + group * index + group / 2;
          const barY = y(item.authorizedAreaM2);
          return (
            <g key={item.year}>
              <rect x={center - bar / 2} y={barY} width={bar} height={PAD.top + plotHeight - barY} rx="5" className="construction-area-bar"><title>{`${item.year}: ${compactArea(item.authorizedAreaM2)}`}</title></rect>
              <text x={center} y={Math.max(13, barY - 7)} textAnchor="middle" className="construction-bar-value construction-area-value">{formatNumber(Math.round(item.authorizedAreaM2))}</text>
              <text x={center} y={HEIGHT - 18} textAnchor="middle" className="construction-year-label">{item.year}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const COMPOSITION = [
  { key: "multifamily", label: "Residencial multifamiliar", className: "composition-multifamily" },
  { key: "residentialUnspecified", label: "Residencial não especificado", className: "composition-residential" },
  { key: "commercialServices", label: "Comercial / serviços", className: "composition-commercial" },
  { key: "industrial", label: "Industrial", className: "composition-industrial" },
  { key: "other", label: "Outros", className: "composition-other" },
] as const;

type CompositionKey = (typeof COMPOSITION)[number]["key"];
type CompositionSelection = { key: CompositionKey; year: number | null } | null;

function CompositionChart({ data }: { data: readonly ConstructionAnnualPoint[] }) {
  const [selection, setSelection] = useState<CompositionSelection>(null);
  const selectedCategory = selection ? COMPOSITION.find((item) => item.key === selection.key) : null;
  const selectedRow = selection?.year != null ? data.find((row) => row.year === selection.year) : null;
  const selectedValue = selectedRow && selection ? selectedRow[selection.key] : null;
  const selectedShare = selectedRow && selectedValue != null && selectedRow.newConstruction
    ? (selectedValue / selectedRow.newConstruction) * 100
    : null;

  function toggleCategory(key: CompositionKey) {
    setSelection((current) => current?.key === key && current.year == null ? null : { key, year: null });
  }

  function toggleSegment(key: CompositionKey, year: number) {
    setSelection((current) => current?.key === key && current.year === year ? null : { key, year });
  }

  return (
    <div className="construction-composition construction-composition-interactive">
      <div className="construction-composition-toolbar">
        <div className="construction-composition-legend" aria-label="Segmentação por uso">
          {COMPOSITION.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`construction-composition-legend-button ${selection?.key === item.key ? "active" : ""} ${selection && selection.key !== item.key ? "muted" : ""}`}
              aria-pressed={selection?.key === item.key}
              onClick={() => toggleCategory(item.key)}
            >
              <i className={item.className} />{item.label}
            </button>
          ))}
        </div>
        <span className="construction-segmentation-hint">Clique na legenda ou em uma faixa para segmentar</span>
      </div>

      {selection ? (
        <div className="construction-segmentation-summary" role="status">
          <div>
            <small>Segmentação ativa</small>
            <strong>{selectedCategory?.label}</strong>
            {selectedRow && selectedValue != null && selectedShare != null ? (
              <span>{selection.year}: {formatNumber(selectedValue)} alvarás · {percent(selectedShare)} da construção nova</span>
            ) : (
              <span>Comparação da categoria ao longo de 2016–2025</span>
            )}
          </div>
          <button type="button" onClick={() => setSelection(null)}>Limpar segmentação ×</button>
        </div>
      ) : null}

      <div className="construction-composition-grid">
        {data.map((row) => {
          const selectedRowActive = selection?.year === row.year;
          const selectedRowMuted = selection?.year != null && selection.year !== row.year;
          const rightValue = selection ? row[selection.key] : row.newConstruction;
          const rightShare = selection && row.newConstruction ? (rightValue / row.newConstruction) * 100 : null;
          return (
            <div
              className={`construction-composition-row ${selectedRowActive ? "row-active" : ""} ${selectedRowMuted ? "row-muted" : ""}`}
              key={row.year}
            >
              <strong>{row.year}</strong>
              <div className="construction-composition-track" aria-label={`Composição de ${row.year}`}>
                {COMPOSITION.map((item) => {
                  const value = row[item.key];
                  const share = row.newConstruction ? (value / row.newConstruction) * 100 : 0;
                  const active = selection?.key === item.key;
                  const muted = Boolean(selection && !active);
                  return (
                    <button
                      type="button"
                      key={item.key}
                      className={`${item.className} construction-composition-segment ${active ? "segment-active" : ""} ${muted ? "segment-muted" : ""}`}
                      style={{ width: `${share}%` }}
                      aria-label={`${row.year} — ${item.label}: ${formatNumber(value)} (${percent(share)})`}
                      aria-pressed={selection?.key === item.key && (selection.year == null || selection.year === row.year)}
                      onClick={() => toggleSegment(item.key, row.year)}
                    >
                      {share >= 6.5 ? <b>{formatNumber(value)}</b> : null}
                      <title>{`${item.label}: ${formatNumber(value)} (${percent(share)})`}</title>
                    </button>
                  );
                })}
              </div>
              <span className={`construction-composition-total ${selection ? "segmented" : ""}`}>
                {formatNumber(rightValue)}{rightShare != null ? <small>{percent(rightShare)}</small> : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConstructionPermitsPanel() {
  const { meta, totals, annual, currentYtd, ytdComparison } = constructionPermitsData;

  return (
    <section className="construction-page">
      <header className="page-hero construction-hero">
        <div>
          <span className="eyebrow">Planejamento urbano · série histórica</span>
          <h1>Construção Civil</h1>
          <p>Evolução dos alvarás emitidos e da área autorizada em Itapoá, com leitura executiva dos últimos 10 anos completos.</p>
        </div>
        <div className="construction-source-card">
          <small>Fonte</small>
          <strong>{meta.source}</strong>
          <span>Extração em {formatDate(meta.extractedAt)}</span>
          <span>2026 parcial até {formatDate(meta.currentCut)}</span>
        </div>
      </header>

      <section className="kpi-grid construction-kpi-grid" aria-label="Indicadores da construção civil">
        <article className="kpi-card tone-blue construction-kpi-card">
          <span className="kpi-accent" />
          <div className="kpi-topline"><span>ALVARÁS · 2016–2025</span></div>
          <strong>{formatNumber(totals.permits)}</strong>
          <p>Todos os tipos emitidos no período.</p>
          <footer><span>Série histórica consolidada</span></footer>
        </article>
        <article className="kpi-card tone-blue construction-kpi-card">
          <span className="kpi-accent" />
          <div className="kpi-topline"><span>CONSTRUÇÃO NOVA</span></div>
          <strong>{formatNumber(totals.newConstruction)}</strong>
          <p>Alvarás classificados como construção nova.</p>
          <footer><span>Volume autorizado</span></footer>
        </article>
        <article className="kpi-card tone-green construction-kpi-card">
          <span className="kpi-accent" />
          <div className="kpi-topline"><span>ÁREA AUTORIZADA</span></div>
          <strong>{compactArea(totals.authorizedAreaM2)}</strong>
          <p>Somente área vinculada à construção nova.</p>
          <footer><span>Intensidade física</span></footer>
        </article>
        <article className="kpi-card tone-purple construction-kpi-card">
          <span className="kpi-accent" />
          <div className="kpi-topline"><span>MEDIANA DE ÁREA</span></div>
          <strong>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(totals.medianAreaM2)} m²</strong>
          <p>Porte central das obras autorizadas.</p>
          <footer><span>Distribuição das áreas</span></footer>
        </article>
      </section>

      <article className="panel construction-panel">
        <div className="panel-heading construction-panel-heading"><div><span className="eyebrow">Volume autorizado</span><h2>Evolução dos alvarás emitidos — 2016 a 2025</h2><p>Total anual e parcela correspondente a construção nova.</p></div></div>
        <CountHistoryChart data={annual} />
      </article>

      <article className="panel construction-panel">
        <div className="panel-heading construction-panel-heading"><div><span className="eyebrow">Intensidade física</span><h2>Área autorizada para construção nova — 2016 a 2025</h2><p>A metragem evidencia o porte físico da atividade, que não aparece apenas na contagem de documentos.</p></div></div>
        <AreaHistoryChart data={annual} />
      </article>

      <section className="panel construction-ytd-section">
        <div className="panel-heading construction-panel-heading"><div><span className="eyebrow">Comparação equivalente</span><h2>2026 até 03/09 × mesmo período de 2025</h2><p>O ano corrente não é comparado diretamente com anos completos.</p></div><span className="panel-chip construction-ytd-chip">2026 YTD · {formatNumber(currentYtd.permits)} alvarás</span></div>
        <div className="construction-ytd-grid">
          {ytdComparison.map((item) => (
            <article key={item.label} className={item.label === "Área autorizada" ? "construction-ytd-highlight" : ""}>
              <span>{item.label}</span>
              <div><strong>{item.unit === "m2" ? compactArea(item.previous) : formatNumber(item.previous)}</strong><b>→</b><strong>{item.unit === "m2" ? compactArea(item.current) : formatNumber(item.current)}</strong></div>
              <em>+{percent(item.changePercent)}</em>
              <small>01/01–03/09/2025 → 01/01–03/09/2026</small>
            </article>
          ))}
        </div>
      </section>

      <article className="panel construction-panel construction-composition-panel">
        <div className="panel-heading construction-panel-heading"><div><span className="eyebrow">Perfil das autorizações</span><h2>Composição da construção nova por uso</h2><p>Participação anual dentro dos alvarás classificados como construção nova. Clique em uma categoria para segmentar a leitura.</p></div></div>
        <CompositionChart data={annual} />
      </article>

      <section className="construction-reading-note">
        <div className="management-note"><strong>Como ler</strong><p>Alvará é autorização administrativa e funciona como indicador antecedente da atividade construtiva; não significa obra concluída.</p></div>
        <div className="management-note"><strong>Limitações da fonte</strong><p>Coeficiente de aproveitamento e outorga onerosa não estão disponíveis nesta extração. “Residencial” sem modalidade explícita não é convertido automaticamente em unifamiliar.</p></div>
      </section>
    </section>
  );
}