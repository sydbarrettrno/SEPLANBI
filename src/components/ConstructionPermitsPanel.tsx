import { constructionPermitsData, type ConstructionAnnualPoint } from "../construction";
import { formatDate, formatNumber } from "../format";

const WIDTH = 960;
const HEIGHT = 340;
const PAD = { top: 22, right: 18, bottom: 48, left: 58 };

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
          return (
            <g key={item.year}>
              <rect x={totalX} y={y(item.permits)} width={bar} height={PAD.top + plotHeight - y(item.permits)} rx="4" className="construction-bar-total"><title>{`${item.year}: ${formatNumber(item.permits)} alvarás totais`}</title></rect>
              <rect x={newX} y={y(item.newConstruction)} width={bar} height={PAD.top + plotHeight - y(item.newConstruction)} rx="4" className="construction-bar-new"><title>{`${item.year}: ${formatNumber(item.newConstruction)} de construção nova`}</title></rect>
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

function CompositionChart({ data }: { data: readonly ConstructionAnnualPoint[] }) {
  return (
    <div className="construction-composition">
      <div className="construction-composition-legend">
        {COMPOSITION.map((item) => <span key={item.key}><i className={item.className} />{item.label}</span>)}
      </div>
      <div className="construction-composition-grid">
        {data.map((row) => (
          <div className="construction-composition-row" key={row.year}>
            <strong>{row.year}</strong>
            <div className="construction-composition-track" aria-label={`Composição de ${row.year}`}>
              {COMPOSITION.map((item) => {
                const value = row[item.key];
                const share = row.newConstruction ? (value / row.newConstruction) * 100 : 0;
                return <span key={item.key} className={item.className} style={{ width: `${share}%` }}><title>{`${item.label}: ${formatNumber(value)} (${percent(share)})`}</title></span>;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConstructionPermitsPanel() {
  const { meta, totals, annual, currentYtd, ytdComparison } = constructionPermitsData;

  return (
    <section className="construction-page">
      <header className="construction-hero">
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

      <section className="construction-kpi-grid" aria-label="Indicadores da construção civil">
        <article><span>Alvarás · 2016–2025</span><strong>{formatNumber(totals.permits)}</strong><small>todos os tipos emitidos</small></article>
        <article><span>Construção nova</span><strong>{formatNumber(totals.newConstruction)}</strong><small>alvarás no período</small></article>
        <article><span>Área autorizada</span><strong>{compactArea(totals.authorizedAreaM2)}</strong><small>somente construção nova</small></article>
        <article><span>Mediana de área</span><strong>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(totals.medianAreaM2)} m²</strong><small>porte central das obras</small></article>
      </section>

      <article className="construction-panel">
        <div className="construction-panel-heading"><div><span className="eyebrow">Volume autorizado</span><h2>Evolução dos alvarás emitidos — 2016 a 2025</h2><p>Total anual e parcela correspondente a construção nova.</p></div></div>
        <CountHistoryChart data={annual} />
      </article>

      <article className="construction-panel">
        <div className="construction-panel-heading"><div><span className="eyebrow">Intensidade física</span><h2>Área autorizada para construção nova — 2016 a 2025</h2><p>A metragem evidencia o porte físico da atividade, que não aparece apenas na contagem de documentos.</p></div></div>
        <AreaHistoryChart data={annual} />
      </article>

      <section className="construction-ytd-section">
        <div className="construction-panel-heading"><div><span className="eyebrow">Comparação equivalente</span><h2>2026 até 03/09 × mesmo período de 2025</h2><p>O ano corrente não é comparado diretamente com anos completos.</p></div><span className="construction-ytd-chip">2026 YTD · {formatNumber(currentYtd.permits)} alvarás</span></div>
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

      <article className="construction-panel">
        <div className="construction-panel-heading"><div><span className="eyebrow">Perfil das autorizações</span><h2>Composição da construção nova por uso</h2><p>Participação anual dentro dos alvarás classificados como construção nova.</p></div></div>
        <CompositionChart data={annual} />
      </article>

      <section className="construction-reading-note">
        <div><strong>Como ler</strong><p>Alvará é autorização administrativa e funciona como indicador antecedente da atividade construtiva; não significa obra concluída.</p></div>
        <div><strong>Limitações da fonte</strong><p>Coeficiente de aproveitamento e outorga onerosa não estão disponíveis nesta extração. “Residencial” sem modalidade explícita não é convertido automaticamente em unifamiliar.</p></div>
      </section>
    </section>
  );
}
