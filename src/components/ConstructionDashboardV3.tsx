import { useEffect, useMemo, useState } from "react";
import { constructionPermitsData } from "../construction";
import { formatDate, formatNumber } from "../format";
import { ConstructionPermitsPanel as ExecutiveConstructionPanel } from "./ConstructionPermitsPanel";

const BASE_LIMIT = 50;

type ConstructionBaseRow = {
  permit: number;
  date: string;
  year: number;
  type: string;
  area: number;
  use: string;
  construction: string;
  coefficient: number | null;
};

type ConstructionBaseResponse = {
  ok: boolean;
  meta: {
    source: string;
    extracted_at: string;
    total: number;
    ca_source?: string;
    ca_records?: number;
  };
  facets: { years: number[]; types: string[]; uses: string[] };
  records: { filtered: number; offset: number; limit: number; items: ConstructionBaseRow[] };
};

function detailedArea(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} m²`;
}

function formatCoefficient(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

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
    const result = new URLSearchParams({
      action: "construction-data",
      limit: String(BASE_LIMIT),
      offset: String(page * BASE_LIMIT),
    });
    if (query.trim()) result.set("q", query.trim());
    if (year) result.set("year", year);
    if (permitType) result.set("type", permitType);
    if (use) result.set("use", use);
    return result;
  }, [query, year, permitType, use, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as ConstructionBaseResponse & { error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Falha ao carregar a relação analítica de alvarás.");
        }
        setData(payload);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Falha ao carregar a relação analítica de alvarás.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 220 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [params, query]);

  const filtered = data?.records.filtered ?? 0;
  const offset = data?.records.offset ?? 0;
  const shownFrom = filtered ? offset + 1 : 0;
  const shownTo = Math.min(offset + (data?.records.limit ?? BASE_LIMIT), filtered);
  const hasNext = shownTo < filtered;

  const clearFilters = () => {
    setQuery("");
    setYear("");
    setPermitType("");
    setUse("");
    setPage(0);
  };

  return (
    <article className="panel construction-panel construction-base-panel">
      <div className="panel-heading construction-panel-heading construction-base-heading">
        <div>
          <span className="eyebrow">Rastreabilidade</span>
          <h2>Relação analítica · alvará por alvará</h2>
          <p>Base sanitizada do IPM com CA estimado proveniente do cruzamento cadastral já realizado. Pesquise e filtre os registros sem dados pessoais.</p>
        </div>
        <div className="construction-base-actions">
          <span className="panel-chip">{formatNumber(data ? filtered : 0)} registros</span>
        </div>
      </div>

      <div className="construction-base-filters">
        <label className="construction-base-search">
          <span>Pesquisar</span>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(0); }}
            placeholder="Nº do alvará, uso ou tipo..."
          />
        </label>
        <label>
          <span>Ano</span>
          <select value={year} onChange={(event) => { setYear(event.target.value); setPage(0); }}>
            <option value="">Todos</option>
            {(data?.facets.years ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Tipo de alvará</span>
          <select value={permitType} onChange={(event) => { setPermitType(event.target.value); setPage(0); }}>
            <option value="">Todos</option>
            {(data?.facets.types ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Uso</span>
          <select value={use} onChange={(event) => { setUse(event.target.value); setPage(0); }}>
            <option value="">Todos</option>
            {(data?.facets.uses ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button type="button" className="ghost-button construction-clear-filter" onClick={clearFilters}>Limpar filtros</button>
      </div>

      {error ? <div className="construction-base-status error">{error}</div> : null}
      {loading && !data ? <div className="construction-base-status">Carregando relação analítica…</div> : null}

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
                  <th>CA estimado</th>
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
                    <td>{formatCoefficient(row.coefficient)}</td>
                  </tr>
                ))}
                {!data.records.items.length ? (
                  <tr><td colSpan={7} className="empty-state">Nenhum alvará encontrado para os filtros selecionados.</td></tr>
                ) : null}
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
          <p className="construction-base-privacy">
            Consulta sem titular, CPF/CNPJ, cadastro, inscrição ou endereço detalhado. O CA exibido é o valor estimado no cruzamento com o Cadastro Imobiliário; registros sem associação consistente permanecem como “—”.
          </p>
        </>
      ) : null}
    </article>
  );
}

export function ConstructionDashboardV3() {
  const [view, setView] = useState<"executive" | "records">("executive");
  const { meta } = constructionPermitsData;

  return (
    <section className="construction-v2-shell">
      <header className="page-hero construction-hero construction-v2-hero">
        <div>
          <span className="eyebrow">Planejamento urbano · série histórica</span>
          <h1>Construção Civil</h1>
          <p>Evolução dos alvarás emitidos e da área autorizada em Itapoá, com indicadores executivos e relação analítica alvará por alvará.</p>
        </div>
        <div className="construction-source-card">
          <small>Fonte</small>
          <strong>{meta.source}</strong>
          <span>Extração em {formatDate(meta.extractedAt)}</span>
          <span>2026 parcial até {formatDate(meta.currentCut)}</span>
        </div>
      </header>

      <nav className="construction-view-switch construction-v2-switch" aria-label="Modo de visualização da construção civil">
        <button type="button" className={view === "executive" ? "active" : ""} aria-pressed={view === "executive"} onClick={() => setView("executive")}>
          <strong>Visão executiva</strong><span>Indicadores e tendências</span>
        </button>
        <button type="button" className={view === "records" ? "active" : ""} aria-pressed={view === "records"} onClick={() => setView("records")}>
          <strong>Relação analítica</strong><span>Alvará por alvará · consulta direta</span>
        </button>
      </nav>

      {view === "executive" ? (
        <>
          <div className="construction-v2-executive"><ExecutiveConstructionPanel /></div>
          <section className="construction-reading-note construction-v2-normalization-note">
            <div className="management-note"><strong>Normalização de uso</strong><p>Registros residenciais são organizados conforme a informação disponível na base; quando a fonte não diferencia explicitamente a tipologia, a interface sinaliza uso residencial não especificado.</p></div>
            <div className="management-note"><strong>CA estimado</strong><p>O coeficiente é apresentado a partir do cruzamento já realizado com o Cadastro Imobiliário. Registros sem vínculo cadastral consistente permanecem sem valor.</p></div>
          </section>
        </>
      ) : <ConstructionBaseTable />}
    </section>
  );
}
