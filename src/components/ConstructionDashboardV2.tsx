import { useEffect, useMemo, useState } from "react";
import { authenticateAdmin } from "../api";
import { constructionPermitsData } from "../construction";
import { formatDate, formatNumber } from "../format";
import { ConstructionPermitsPanel as LegacyConstructionPermitsPanel } from "./ConstructionPermitsPanel";

const BASE_LIMIT = 25;

type ComparisonItem = {
  label: string;
  previous: number | null;
  current: number | null;
  change_percent: number | null;
  unit: "count" | "m2" | "coefficient";
};

type PrivateRow = {
  permit: number;
  permit_id: string;
  date: string;
  year: number;
  permit_type: string;
  authorized_area_m2: number | null;
  existing_area_m2: number | null;
  applicant: string;
  use_raw: string;
  use: string;
  construction_type: string;
  cadastre_permit: string;
  registration_permit: string;
  street_permit: string;
  number_permit: string;
  link_status: string;
  link_method: string;
  link_confidence: string;
  linked_parcels: number;
  current_cadastre: string;
  current_registration: string;
  lot_area_m2: number | null;
  current_owner: string;
  current_document: string;
  owner_code: string;
  neighborhood: string;
  block: string;
  lot: string;
  linked_cadastre_type: string;
  land_code_when_unit: string;
  ca_reference_area_m2: number | null;
  ca_estimated: number | null;
  ca_band: string;
  ca_status: string;
  outorga: string;
};

type PrivateResponse = {
  ok: boolean;
  meta: { source?: string; source_name?: string; installed_at?: string; rows?: number; current_cut?: string };
  facets: { years: number[]; types: string[]; uses: string[]; neighborhoods: string[]; ca_bands: string[] };
  comparison: ComparisonItem[];
  records: { filtered: number; offset: number; limit: number; items: PrivateRow[] };
};

type StatusResponse = {
  ok: boolean;
  configured: boolean;
  rows: number;
  meta: PrivateResponse["meta"];
};

function formatArea(value: number | null) {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} m²`;
}

function formatCompactArea(value: number | null) {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value)} m²`;
}

function formatCoefficient(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);
}

function comparisonValue(item: ComparisonItem, value: number | null) {
  if (value == null) return "—";
  if (item.unit === "m2") return formatCompactArea(value);
  if (item.unit === "coefficient") return formatCoefficient(value);
  return formatNumber(Math.round(value));
}

function RestrictedLogin({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await authenticateAdmin(password);
      if (!result.authorized) throw new Error("Acesso não autorizado.");
      setPassword("");
      onAuthenticated();
    } catch (reason) {
      setPassword("");
      setError(reason instanceof Error ? reason.message : "Não foi possível validar o acesso.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel construction-private-lock">
      <div className="construction-private-lock-icon" aria-hidden="true">⌕</div>
      <span className="eyebrow">ACESSO RESTRITO</span>
      <h2>Relação analítica de alvarás</h2>
      <p>A base alvará por alvará contém solicitante e dados cadastrais de apoio. A visualização e a exportação exigem autenticação.</p>
      <form onSubmit={submit}>
        <label>
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Informe a senha de acesso"
          />
        </label>
        {error ? <p className="construction-private-error" role="alert">{error}</p> : null}
        <button type="submit" className="primary-button" disabled={submitting || !password}>
          {submitting ? "Validando…" : "Acessar relação analítica"}
        </button>
      </form>
    </section>
  );
}

function ComparisonCards({ items }: { items: ComparisonItem[] }) {
  return (
    <section className="construction-private-comparison" aria-label="Comparativo 2026 e 2025">
      {items.map((item) => {
        const positive = (item.change_percent ?? 0) >= 0;
        return (
          <article key={item.label}>
            <span>{item.label}</span>
            <em className={positive ? "positive" : "negative"}>
              {item.change_percent == null ? "—" : `${positive ? "+" : ""}${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(item.change_percent)}%`}
            </em>
            <div>
              <strong>{comparisonValue(item, item.previous)}</strong>
              <b>→</b>
              <strong>{comparisonValue(item, item.current)}</strong>
            </div>
            <small>01/01–03/09/2025 → 01/01–03/09/2026</small>
          </article>
        );
      })}
    </section>
  );
}

function PrivateBase() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [permitType, setPermitType] = useState("");
  const [use, setUse] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [caBand, setCaBand] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PrivateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function refreshStatus(signal?: AbortSignal) {
    const response = await fetch("/api/construction?action=status", { signal, cache: "no-store" });
    const payload = await response.json() as StatusResponse & { error?: string };
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Falha ao consultar a base privada.");
    setStatus(payload);
    return payload;
  }

  useEffect(() => {
    const controller = new AbortController();
    refreshStatus(controller.signal).catch((reason) => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Falha ao consultar a base privada.");
    });
    return () => controller.abort();
  }, []);

  const params = useMemo(() => {
    const result = new URLSearchParams({ action: "data", limit: String(BASE_LIMIT), offset: String(page * BASE_LIMIT) });
    if (query.trim()) result.set("q", query.trim());
    if (year) result.set("year", year);
    if (permitType) result.set("type", permitType);
    if (use) result.set("use", use);
    if (neighborhood) result.set("neighborhood", neighborhood);
    if (caBand) result.set("ca_band", caBand);
    return result;
  }, [query, year, permitType, use, neighborhood, caBand, page]);

  const exportUrl = useMemo(() => {
    const result = new URLSearchParams({ action: "export" });
    if (query.trim()) result.set("q", query.trim());
    if (year) result.set("year", year);
    if (permitType) result.set("type", permitType);
    if (use) result.set("use", use);
    if (neighborhood) result.set("neighborhood", neighborhood);
    if (caBand) result.set("ca_band", caBand);
    return `/api/construction?${result.toString()}`;
  }, [query, year, permitType, use, neighborhood, caBand]);

  useEffect(() => {
    if (!status?.configured) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/construction?${params.toString()}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as PrivateResponse & { error?: string };
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Falha ao carregar a relação analítica.");
        setData(payload);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Falha ao carregar a relação analítica.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 220 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [status?.configured, params, query]);

  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const response = await fetch("/api/construction?action=upload", {
        method: "POST",
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "X-SEPLAN-Source-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Falha ao carregar a base.");
      const nextStatus = await refreshStatus();
      if (nextStatus.configured) setPage(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar a base.");
    } finally {
      setUploading(false);
    }
  }

  const filtered = data?.records.filtered ?? 0;
  const offset = data?.records.offset ?? 0;
  const shownFrom = filtered ? offset + 1 : 0;
  const shownTo = Math.min(offset + (data?.records.limit ?? BASE_LIMIT), filtered);
  const hasNext = shownTo < filtered;

  if (!status) {
    return <section className="panel construction-private-status">Verificando base privada…</section>;
  }

  if (!status.configured) {
    return (
      <section className="panel construction-private-upload">
        <span className="eyebrow">BASE PRIVADA</span>
        <h2>Carregar relação analítica</h2>
        <p>Use a base preparada para o SEPLANBI. O arquivo é gravado no armazenamento privado do servidor e não é incorporado ao repositório público.</p>
        <label className="primary-button construction-private-file-button">
          {uploading ? "Carregando…" : "Selecionar base CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {error ? <p className="construction-private-error" role="alert">{error}</p> : null}
      </section>
    );
  }

  return (
    <>
      <section className="construction-records-intro construction-private-intro">
        <div>
          <span className="eyebrow">Relação analítica</span>
          <h2>Alvará por alvará · base completa</h2>
          <p>Consulta interna com os campos solicitados para comparação da evolução da construção civil. Uso normalizado e CA estimado incorporados ao cruzamento cadastral.</p>
        </div>
        <div className="construction-records-meta"><strong>{formatNumber(status.rows)}</strong><span>registros protegidos</span></div>
      </section>

      {data?.comparison?.length ? <ComparisonCards items={data.comparison} /> : null}

      <article className="panel construction-panel construction-base-panel construction-private-base-panel">
        <div className="panel-heading construction-panel-heading construction-base-heading">
          <div>
            <span className="eyebrow">Base completa</span>
            <h2>Relação analítica de alvarás</h2>
            <p>Solicitante, área autorizada, uso normalizado, cadastro imobiliário, CA estimado e rastreabilidade do cruzamento.</p>
          </div>
          <div className="construction-base-actions">
            <span className="panel-chip">{formatNumber(filtered)} registros</span>
            <a className="primary-button construction-export-button" href={exportUrl}>Exportar base completa (CSV)</a>
          </div>
        </div>

        <div className="construction-base-filters construction-private-filters">
          <label className="construction-base-search">
            <span>Pesquisar</span>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Alvará, solicitante, CPF/CNPJ, cadastro, rua..." />
          </label>
          <label><span>Ano</span><select value={year} onChange={(event) => { setYear(event.target.value); setPage(0); }}><option value="">Todos</option>{(data?.facets.years ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Tipo de alvará</span><select value={permitType} onChange={(event) => { setPermitType(event.target.value); setPage(0); }}><option value="">Todos</option>{(data?.facets.types ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Uso normalizado</span><select value={use} onChange={(event) => { setUse(event.target.value); setPage(0); }}><option value="">Todos</option>{(data?.facets.uses ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Bairro</span><select value={neighborhood} onChange={(event) => { setNeighborhood(event.target.value); setPage(0); }}><option value="">Todos</option>{(data?.facets.neighborhoods ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Faixa CA</span><select value={caBand} onChange={(event) => { setCaBand(event.target.value); setPage(0); }}><option value="">Todas</option>{(data?.facets.ca_bands ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <button type="button" className="ghost-button construction-clear-filter" onClick={() => { setQuery(""); setYear(""); setPermitType(""); setUse(""); setNeighborhood(""); setCaBand(""); setPage(0); }}>Limpar filtros</button>
        </div>

        {error ? <div className="construction-base-status error">{error}</div> : null}
        {loading && !data ? <div className="construction-base-status">Carregando relação analítica…</div> : null}

        {data ? (
          <>
            <div className={`table-scroll construction-base-table-wrap construction-private-table-wrap ${loading ? "loading" : ""}`}>
              <table className="construction-base-table construction-private-table">
                <thead><tr>
                  <th>Alvará</th><th>Data</th><th>Solicitante</th><th>Tipo</th><th className="number-column">Área autorizada</th><th>Uso</th><th>Bairro</th><th className="number-column">Área terreno</th><th>CA estimado</th><th>Outorga</th><th>Cadastro</th><th>Inscrição</th><th>Endereço</th><th>Vínculo</th>
                </tr></thead>
                <tbody>
                  {data.records.items.map((row) => (
                    <tr key={`${row.permit_id}-${row.date}-${row.permit_type}`}>
                      <td><strong className="protocol-number">{row.permit_id}</strong></td>
                      <td>{formatDate(row.date)}</td>
                      <td className="construction-private-applicant">{row.applicant || "—"}</td>
                      <td><span className="construction-type-badge">{row.permit_type}</span></td>
                      <td className="number-column"><strong>{formatArea(row.authorized_area_m2)}</strong></td>
                      <td>{row.use || "—"}</td>
                      <td>{row.neighborhood || "—"}</td>
                      <td className="number-column">{formatArea(row.lot_area_m2)}</td>
                      <td><strong>{formatCoefficient(row.ca_estimated)}</strong>{row.ca_status ? <small className="construction-private-cell-note">{row.ca_status}</small> : null}</td>
                      <td>{row.outorga || "N/D na fonte"}</td>
                      <td>{row.cadastre_permit || row.current_cadastre || "—"}</td>
                      <td>{row.registration_permit || row.current_registration || "—"}</td>
                      <td>{[row.street_permit, row.number_permit].filter(Boolean).join(", ") || "—"}</td>
                      <td>{row.link_status || "—"}{row.link_confidence ? <small className="construction-private-cell-note">{row.link_confidence}</small> : null}</td>
                    </tr>
                  ))}
                  {!data.records.items.length ? <tr><td colSpan={14} className="empty-state">Nenhum alvará encontrado para os filtros selecionados.</td></tr> : null}
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
            <div className="construction-private-footnote">
              <span>CA estimado = área de referência do alvará ÷ área do terreno cruzada.</span>
              <span>Outorga onerosa permanece identificada como N/D quando a fonte não contém informação suficiente.</span>
            </div>
          </>
        ) : null}
      </article>
    </>
  );
}

interface ConstructionDashboardV2Props {
  adminAuthorized: boolean;
  onAdminAuthenticated: () => void;
}

export function ConstructionDashboardV2({ adminAuthorized, onAdminAuthenticated }: ConstructionDashboardV2Props) {
  const [view, setView] = useState<"executive" | "records">("executive");
  const { meta } = constructionPermitsData;

  return (
    <section className="construction-v2-shell">
      <header className="page-hero construction-hero construction-v2-hero">
        <div>
          <span className="eyebrow">Planejamento urbano · série histórica</span>
          <h1>Construção Civil</h1>
          <p>Evolução dos alvarás, área autorizada e intensidade construtiva em Itapoá, com relação analítica protegida para uso interno.</p>
        </div>
        <div className="construction-source-card">
          <small>Fonte</small>
          <strong>Sistema IPM + Cadastro Imobiliário</strong>
          <span>Extração em {formatDate(meta.extractedAt)}</span>
          <span>2026 parcial até {formatDate(meta.currentCut)}</span>
        </div>
      </header>

      <nav className="construction-view-switch construction-v2-switch" aria-label="Modo de visualização da construção civil">
        <button type="button" className={view === "executive" ? "active" : ""} aria-pressed={view === "executive"} onClick={() => setView("executive")}>
          <strong>Visão executiva</strong><span>Indicadores e tendências</span>
        </button>
        <button type="button" className={view === "records" ? "active" : ""} aria-pressed={view === "records"} onClick={() => setView("records")}>
          <strong>Relação analítica</strong><span>Alvará por alvará · acesso restrito</span>
        </button>
      </nav>

      {view === "executive" ? (
        <>
          <div className="construction-v2-executive"><LegacyConstructionPermitsPanel /></div>
          <section className="construction-reading-note construction-v2-normalization-note">
            <div className="management-note"><strong>Normalização de uso</strong><p>“Residencial” é tratado como residencial unifamiliar. Registros com finalidade residencial e comercial são classificados como misto residencial/comercial.</p></div>
            <div className="management-note"><strong>CA estimado</strong><p>O cruzamento com o Cadastro Imobiliário permite estimar o coeficiente pela relação entre área de referência do alvará e área do terreno, preservando o CA oficial quando indisponível como informação distinta.</p></div>
          </section>
        </>
      ) : adminAuthorized ? <PrivateBase /> : <RestrictedLogin onAuthenticated={onAdminAuthenticated} />}
    </section>
  );
}
