import { useEffect, useMemo, useState } from "react";
import { constructionPermitsData, type ConstructionAnnualPoint } from "../construction";
import { formatDate, formatNumber } from "../format";

const WIDTH = 960;
const HEIGHT = 360;
const PAD = { top: 40, right: 18, bottom: 48, left: 58 };
const BASE_LIMIT = 25;

function compactArea(value: number) {
  if (value >= 1_000_000) return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value / 1_000_000)} mi m²`;
  return `${formatNumber(Math.round(value))} m²`;
}

function detailedArea(value: number) {
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} m²`;
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
  { key: "residentialUnspecified", label: "Residencial — não especificado", className: "composition-residential" },
  { key: "commercialServices", label: "Comercial / serviços", className: "composition-commercial" },
  { key: "industrial", label: "Industrial", className: "composition-industrial" },
  { key: "other", label: "Outros", className: "composition-other" },
] as const;

type CompositionKey = (typeof COMPOSITION)[number]["key"];
type CompositionSelection = { key: CompositionKey; year: number | null } | null;

function CompositionChart({ data }: { data: readonly ConstructionAnnualPoint[] }) {
  const [selection, setSelection] = useState<CompositionSelection>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const visibleData = showFullHistory ? data : data.slice(-5);
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
        <div className="construction-composition-toolbar-main">
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
          <span className="construction-segmentation-hint">Selecione uma categoria ou faixa para detalhar</span>
        </div>
        <div className="construction-period-switch" role="group" aria-label="Período da composição por uso">
          <button type="button" aria-pressed={!showFullHistory} className={!showFullHistory ? "active" : ""} onClick={() => { setShowFullHistory(false); setSelection(null); }}>2021–2025</button>
          <button type="button" aria-pressed={showFullHistory} className={showFullHistory ? "active" : ""} onClick={() => { setShowFullHistory(true); setSelection(null); }}>2016–2025</button>
        </div>
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
        {visibleData.map((row) => {
          const selectedRowActive = selection?.year === row.year;
          const selectedRowMuted = selection?.year != null && selection.year !== row.year;
          const rightValue = selection ? row[selection.key] : row.newConstruction;
          const rightShare = selection && row.newConstruction ? (rightValue / row.newConstruction) * 100 : null;
          return (
            <div className={`construction-composition-row ${selectedRowActive ? "row-active" : ""} ${selectedRowMuted ? "row-muted" : ""}`} key={row.year}>
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

type ConstructionBaseRow = {
  permit: number;
  date: string;
  year: number;
  type: string;
  area: number;
  use: string;
  construction: string;
};

type ConstructionBaseResponse = {
  ok: boolean;
  meta: { source: string; extracted_at: string; total: number };
  facets: { years: number[]; types: string[]; uses: string[] };
  records: { filtered: number; offset: number; limit: number; items: ConstructionBaseRow[] };
};

function ConstructionBaseTable() {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [permitType, setPermitType] = useState("");
  const [use, setUse] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ConstructionBaseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const params = useMemo(() => {
    const result = new URLSearchParams({ action: "construction-data", limit: String(BASE_LIMIT), offset: String(page * BASE_LIMIT) });
    if (query.trim()) result.set("q", query.trim());
    if (year) result.set("year", year);
    if (permitType) result.set("type", permitType);
    if (use) result.set("use", use);
    return result;
  }, [query, year, permitType, use, page]);

  const exportUrl = useMemo(() => {
    const result = new URLSearchParams({ action: "construction-export" });
    if (query.trim()) result.set("q", query.trim());
    if (year) result.set("year", year);
    if (permitType) result.set("type", permitType);
    if (use) result.set("use", use);
    return `/api?${result.toString()}`;
  }, [query, year, permitType, use]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api?${params.toString()}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as ConstructionBaseResponse & { error?: string };
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Falha ao carregar a base de alvarás.");
        setData(payload);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "Falha ao carregar a base de alvarás.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 220 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [params, query]);

  const resetPage = () => setPage(0);
  const clearFilters = () => {
    setQuery("");
    setYear("");
    setPermitType("");
    setUse("");
    setPage(0);
  };

  const filtered = data?.records.filtered ?? 0;
  const offset = data?.records.offset ?? 0;
  const shownFrom = filtered ? offset + 1 : 0;
  const shownTo = Math.min(offset + (data?.records.limit ?? BASE_LIMIT), filtered);
  const hasNext = shownTo < filtered;

  return (
    <article className="panel construction-panel construction-base-panel">
      <div className="panel-heading construction-panel-heading construction-base-heading">
        <div>
          <span className="eyebrow">Rastreabilidade</span>
          <h2>Base analítica — alvará por alvará</h2>
          <p>Relação da extração do IPM de 2016 até 03/09/2026. Pesquise, filtre e exporte os registros exibidos.</p>
        </div>
        <div className="construction-base-actions">
          <span className="panel-chip">{formatNumber(data ? filtered : 0)} registros</span>
          <a className="primary-button construction-export-button" href={exportUrl}>Exportar resultados (CSV)</a>
        </div>
      </div>

      <div className="construction-base-filters">
        <label className="construction-base-search">
          <span>Pesquisar</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder="Nº do alvará, tipo, uso ou construção..." />
        </label>
        <label>
          <span>Ano</span>
          <select value={year} onChange={(event) => { setYear(event.target.value); resetPage(); }}>
            <option value="">Todos</option>
            {(data?.facets.years ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Tipo de alvará</span>
          <select value={permitType} onChange={(event) => { setPermitType(event.target.value); resetPage(); }}>
            <option value="">Todos</option>
            {(data?.facets.types ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Uso</span>
          <select value={use} onChange={(event) => { setUse(event.target.value); resetPage(); }}>
            <option value="">Todos</option>
            {(data?.facets.uses ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button type="button" className="ghost-button construction-clear-filter" onClick={clearFilters}>Limpar filtros</button>
      </div>

      {error ? <div className="construction-base-status error">{error}</div> : null}
      {loading && !data ? <div className="construction-base-status">Carregando base analítica…</div> : null}

      {data ? (
        <>
          <div className={`table-scroll construction-base-table-wrap ${loading ? "loading" : ""}`}>
            <table className="construction-base-table">
              <thead>
                <tr>
                  <th>Alvará</th>
                  <th>Data de emissão</th>
                  <th>Tipo de alvará</th>
                  <th className="number-column">Área autorizada</th>
                  <th>Uso</th>
                  <th>Construção</th>
                </tr>
              </thead>
              <tbody>
                {data.records.items.map((row) => (
                  <tr key={`${row.year}-${row.permit}-${row.date}-${row.type}`}>
                    <td><strong className="protocol-number">{row.permit}/{row.year}</strong></td>
                    <td>{formatDate(row.date)}</td>
                    <td><span className="construction-type-badge">{row.type}</span></td>
                    <td className="number-column"><strong>{detailedArea(row.area)}</strong></td>
                    <td>{row.use || "—"}</td>
                    <td>{row.construction || "—"}</td>
                  </tr>
                ))}
                {!data.records.items.length ? <tr><td colSpan={6} className="empty-state">Nenhum alvará encontrado para os filtros selecionados.</td></tr> : null}
              </tbody>
            </table>
          </div>

          <div className="construction-base-footer">
            <span>Exibindo {formatNumber(shownFrom)}–{formatNumber(shownTo)} de {formatNumber(filtered)} registros</span>
            <div className="pager">
              <button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))}>← Anterior</button>
              <button type="button" disabled={!hasNext || loading} onClick={() => setPage((current) => current + 1)}>Próxima →</button>
            </div>
          </div>
          <p className="construction-base-privacy">Consulta pública com campos administrativos não sensíveis. Titular, CPF/CNPJ, cadastro, inscrição e endereço detalhado permanecem fora desta visualização.</p>
        </>
      ) : null}
    </article>
  );
}

export function ConstructionPermitsPanel() {
  const { meta, totals, annual, currentYtd, ytdComparison } = constructionPermitsData;
  const [view, setView] = useState<"executive" | "records">("executive");
  const [historyMetric, setHistoryMetric] = useState<"permits" | "area">("permits");

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

      <nav className="construction-view-switch" aria-label="Modo de visualização da construção civil">
        <button type="button" className={view === "executive" ? "active" : ""} aria-pressed={view === "executive"} onClick={() => setView("executive")}>
          <strong>Visão executiva</strong>
          <span>Indicadores e tendências</span>
        </button>
        <button type="button" className={view === "records" ? "active" : ""} aria-pressed={view === "records"} onClick={() => setView("records")}>
          <strong>Consultar alvarás</strong>
          <span>Pesquisa, filtros e exportação</span>
        </button>
      </nav>

      {view === "executive" ? (
        <>
          <section className="panel construction-ytd-section construction-ytd-priority">
            <div className="panel-heading construction-panel-heading"><div><span className="eyebrow">Cenário atual</span><h2>2026 até 03/09 × mesmo período de 2025</h2><p>Os três sinais avançaram no período equivalente. A área autorizada cresceu mais que a quantidade de alvarás.</p></div><span className="panel-chip construction-ytd-chip">2026 parcial · {formatNumber(currentYtd.permits)} alvarás</span></div>
            <div className="construction-ytd-grid">
              {ytdComparison.map((item) => (
                <article key={item.label} className={item.label === "Área autorizada" ? "construction-ytd-highlight" : ""}>
                  <span>{item.label}</span>
                  <em>+{percent(item.changePercent)}</em>
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
              <article className="kpi-card tone-blue construction-kpi-card">
                <span className="kpi-accent" />
                <div className="kpi-topline"><span>ALVARÁS EMITIDOS</span></div>
                <strong>{formatNumber(totals.permits)}</strong>
                <p>Todos os tipos emitidos no período.</p>
                <footer><span>2016–2025</span></footer>
              </article>
              <article className="kpi-card tone-blue construction-kpi-card">
                <span className="kpi-accent" />
                <div className="kpi-topline"><span>CONSTRUÇÃO NOVA</span></div>
                <strong>{formatNumber(totals.newConstruction)}</strong>
                <p>Alvarás classificados como construção nova.</p>
                <footer><span>2016–2025</span></footer>
              </article>
              <article className="kpi-card tone-green construction-kpi-card">
                <span className="kpi-accent" />
                <div className="kpi-topline"><span>ÁREA AUTORIZADA</span></div>
                <strong>{compactArea(totals.authorizedAreaM2)}</strong>
                <p>Somente área vinculada à construção nova.</p>
                <footer><span>2016–2025</span></footer>
              </article>
              <article className="kpi-card tone-purple construction-kpi-card">
                <span className="kpi-accent" />
                <div className="kpi-topline"><span>MEDIANA DE ÁREA</span></div>
                <strong>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(totals.medianAreaM2)} m²</strong>
                <p>Porte central das construções novas.</p>
                <footer><span>2016–2025</span></footer>
              </article>
            </div>
          </section>

          <article className="panel construction-panel construction-history-panel">
            <div className="panel-heading construction-panel-heading">
              <div><span className="eyebrow">Evolução anual</span><h2>{historyMetric === "permits" ? "Alvarás emitidos" : "Área autorizada para construção nova"} · 2016–2025</h2><p>{historyMetric === "permits" ? "Total anual e parcela correspondente a construção nova." : "A metragem mostra o porte físico autorizado, além da contagem de documentos."}</p></div>
              <div className="construction-metric-switch" role="group" aria-label="Indicador do histórico anual">
                <button type="button" aria-pressed={historyMetric === "permits"} className={historyMetric === "permits" ? "active" : ""} onClick={() => setHistoryMetric("permits")}>Alvarás</button>
                <button type="button" aria-pressed={historyMetric === "area"} className={historyMetric === "area" ? "active" : ""} onClick={() => setHistoryMetric("area")}>Área autorizada</button>
              </div>
            </div>
            {historyMetric === "permits" ? <CountHistoryChart data={annual} /> : <AreaHistoryChart data={annual} />}
          </article>

          <article className="panel construction-panel construction-composition-panel">
            <div className="panel-heading construction-panel-heading"><div><span className="eyebrow">Perfil das autorizações</span><h2>Composição da construção nova por uso</h2><p>Participação anual dentro dos alvarás classificados como construção nova. A visão inicia nos cinco anos completos mais recentes.</p></div></div>
            <CompositionChart data={annual} />
          </article>

          <section className="construction-reading-note">
            <div className="management-note"><strong>Como interpretar</strong><p>Alvará é autorização administrativa e funciona como indicador antecedente da atividade construtiva; não significa obra concluída.</p></div>
            <div className="management-note"><strong>Limitações da fonte</strong><p>“Residencial” sem modalidade explícita permanece como não especificado. Coeficiente de aproveitamento e outorga onerosa não constam nesta extração.</p></div>
          </section>
        </>
      ) : (
        <>
          <section className="construction-records-intro">
            <div><span className="eyebrow">Consulta pública</span><h2>Localize um alvará ou recorte a base</h2><p>Use ano, tipo e uso para reduzir o universo. A exportação respeita os filtros aplicados.</p></div>
            <div className="construction-records-meta"><strong>{formatNumber(currentYtd.permits)}</strong><span>alvarás em 2026 até 03/09</span></div>
          </section>
          <ConstructionBaseTable />
        </>
      )}
    </section>
  );
}
