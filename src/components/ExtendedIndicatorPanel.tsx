import { useEffect, useMemo, useState } from "react";
import { fetchExtendedIndicator } from "../api";
import { useDashboardContent } from "../content/DashboardContentContext";
import type { DashboardCopy } from "../content/dashboardCopy";
import type { ExtendedKpi, ExtendedResponse } from "../extended";
import { formatDate, formatDays, formatNumber, formatPercent } from "../format";
import type { DashboardFilters } from "../types";
import { InteractiveBars, MetricTile, type VisualItem } from "./BiVisuals";

interface Props {
  kpi: ExtendedKpi;
  filters: DashboardFilters;
  onFilters: (filters: DashboardFilters) => void;
}

const OWNER_TO_RESPONSIBILITY: Record<string, string> = {
  Interno: "Fila Interna SEPLAN",
  Externo: "Aguardando Responsável Externo",
  Paralisado: "Paralisado",
};

const RESPONSIBILITY_TO_OWNER: Record<string, string> = {
  "Fila Interna SEPLAN": "Interno",
  "Aguardando Responsável Externo": "Externo",
  Paralisado: "Paralisado",
};

function pageCopy(copy: DashboardCopy, kpi: ExtendedKpi) {
  switch (kpi) {
    case 4: return copy.kpi04;
    case 5: return copy.kpi05;
    case 6: return copy.kpi06;
    case 7: return copy.kpi07;
    case 8: return copy.kpi08;
    case 9: return copy.kpi09;
    case 10: return copy.kpi10;
    case 11: return copy.kpi11;
  }
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function read(source: Record<string, unknown> | null | undefined, key: string): unknown {
  return source?.[key];
}

function rowsToVisuals(rows: unknown[] | undefined, valueKey = "value"): VisualItem[] {
  return (rows ?? []).flatMap((raw) => {
    const item = asObject(raw);
    if (!item) return [];
    const name = String(item.name ?? "Não informado");
    const value = asNumber(item[valueKey]);
    const eligible = asNumber(item.eligible);
    return [{ key: name, label: name, value, context: eligible ? `n=${formatNumber(eligible)}` : undefined }];
  });
}

function DetailTable({ records, eyebrow, title }: { records: ExtendedResponse["records"]; eyebrow: string; title: string }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  if (!records) return null;
  if (records.items.some((item) => Boolean(item.Projeto))) {
    const selected = records.items.find((item) => String(item.ID) === selectedProjectId);
    return <article className="panel table-panel extended-detail"><div className="table-toolbar"><div><span className="eyebrow">CARTEIRA FILTRADA</span><h2>Projetos Públicos</h2><p>{formatNumber(records.total)} projetos visíveis. Selecione uma linha para ver o detalhamento.</p></div></div><div className="table-wrap"><table><thead><tr><th>Projeto / Demanda</th><th>Secretaria / Interface</th><th>Grupo</th><th>Fase</th><th>Status</th><th>Atividade atual</th><th>Dependência / Bloqueio</th><th>Referência</th><th>Confiança</th></tr></thead><tbody>{records.items.map((item, index) => <tr key={item.ID ?? index} className={String(item.ID) === selectedProjectId ? "selected-project-row" : ""} onClick={() => setSelectedProjectId(String(item.ID))}><td><button type="button" className="project-link" onClick={() => setSelectedProjectId(String(item.ID))}>{item.Projeto}</button></td><td>{item.Interface}</td><td>{item.Grupo}</td><td>{item.FaseAtual}</td><td><span className="table-badge">{item.StatusAtual}</span></td><td>{item.current_activity ?? "—"}</td><td>{item.blocker ?? "—"}</td><td>{formatDate(item.DataReferencia)}</td><td>{item.Confianca}</td></tr>)}</tbody></table></div>{selected ? <section className="project-detail" aria-live="polite"><div><span className="eyebrow">DETALHAMENTO DO PROJETO</span><h3>{selected.Projeto}</h3></div><button type="button" className="ghost-button" onClick={() => setSelectedProjectId("")}>Fechar</button><dl><dt>Secretaria / Interface</dt><dd>{selected.Interface}</dd><dt>Grupo</dt><dd>{selected.Grupo}</dd><dt>Fase atual</dt><dd>{selected.FaseAtual}</dd><dt>Status atual</dt><dd>{selected.StatusAtual}</dd><dt>Atividade atual</dt><dd>{selected.current_activity || "—"}</dd><dt>Dependência / Bloqueio</dt><dd>{selected.blocker || "—"}</dd><dt>Evidência atual da fonte</dt><dd>{selected.evidence || "—"}</dd><dt>Fonte</dt><dd>{selected.source_detail || "—"}</dd><dt>Data de referência</dt><dd>{formatDate(selected.DataReferencia)}</dd><dt>Confiança</dt><dd>{selected.Confianca || "—"}</dd><dt>Observação de auditoria</dt><dd>{selected.audit_note || "—"}</dd></dl></section> : null}</article>;
  }
  return (
    <article className="panel table-panel extended-detail">
      <div className="table-toolbar"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p data-record-count={records.total}>{formatNumber(records.total)} registros no cruzamento ativo.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Protocolo / ID</th><th>Abertura / referência</th><th>Categoria / fase</th><th>Status</th><th>Setor de tramitação</th><th>Medida</th></tr></thead><tbody>
        {records.items.map((item, index) => (
          <tr key={item.protocol_id ?? item.ID ?? index}>
            <td className="protocol">{item.protocol ?? item.ID ?? "—"}</td>
            <td>{item.opened ?? item.DataReferencia ?? "—"}</td>
            <td>{item.category ?? item.FaseAtual ?? "—"}</td>
            <td><span className="table-badge">{item.status ?? item.StatusAtual ?? "—"}</span></td>
            <td>{item.sector ?? "—"}</td>
            <td>{item.duration_days !== undefined ? `${formatNumber(item.duration_days)} d` : item.days_without_movement != null ? `${formatNumber(item.days_without_movement)} d` : item.diligence_count !== undefined ? `${formatNumber(item.diligence_count)} dilig.` : "—"}</td>
          </tr>
        ))}
      </tbody></table></div>
    </article>
  );
}

function Matrix({ data, onCell }: { data: NonNullable<ExtendedResponse["matrix"]>; onCell: (row: string, column: string) => void }) {
  const lookup = new Map(data.cells.map((cell) => [`${cell.row}\u001f${cell.column}`, cell.value]));
  return (
    <div className="table-wrap matrix-wrap"><table className="bi-matrix"><thead><tr><th>{data.row_dimension}</th>{data.columns.map((column) => <th key={column}>{column}</th>)}<th>Total</th></tr></thead><tbody>
      {data.rows.map((row) => {
        const total = data.columns.reduce((sum, column) => sum + (lookup.get(`${row}\u001f${column}`) ?? 0), 0);
        return <tr key={row}><th>{row}</th>{data.columns.map((column) => {
          const value = lookup.get(`${row}\u001f${column}`) ?? 0;
          return <td key={column}>{value ? <button type="button" className="matrix-cell" onClick={() => onCell(row, column)}>{formatNumber(value)}</button> : "—"}</td>;
        })}<td><strong>{formatNumber(total)}</strong></td></tr>;
      })}
    </tbody></table></div>
  );
}

export function ExtendedIndicatorPanel({ kpi, filters, onFilters }: Props) {
  const { copy } = useDashboardContent();
  const [data, setData] = useState<ExtendedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inactivityBand, setInactivityBand] = useState("");
  const [projectPhase, setProjectPhase] = useState("");
  const [projectStatus, setProjectStatus] = useState("");
  const [projectInterface, setProjectInterface] = useState("");
  const [projectGroup, setProjectGroup] = useState("");
  const [projectConfidence, setProjectConfidence] = useState("");
  const [rowDimension, setRowDimension] = useState("category");
  const [columnDimension, setColumnDimension] = useState("status");

  const request = useMemo(() => ({
    kpi,
    from: filters.from,
    to: filters.to,
    year: filters.year,
    month: filters.month,
    macro: filters.macro,
    category: filters.category,
    status: filters.status,
    sector: filters.sector,
    responsibility: filters.owner ? OWNER_TO_RESPONSIBILITY[filters.owner] ?? filters.owner : undefined,
    threshold: filters.threshold,
    inactivityBand,
    projectPhase,
    projectStatus,
    projectInterface,
    projectGroup,
    projectConfidence,
    rowDimension,
    columnDimension,
    q: filters.q,
    limit: 100,
  }), [columnDimension, filters, inactivityBand, kpi, projectConfidence, projectGroup, projectInterface, projectPhase, projectStatus, rowDimension]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchExtendedIndicator(request, controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Falha ao carregar o indicador.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request]);

  const currentCopy = pageCopy(copy, kpi);
  const apply = (patch: Partial<DashboardFilters>) => onFilters({ ...filters, ...patch, offset: 0 });
  const toggle = (field: keyof DashboardFilters, value: string) => apply({ [field]: filters[field] === value ? "" : value } as Partial<DashboardFilters>);
  const clear = () => {
    apply({ month: "", macro: "", category: "", status: "", owner: "", sector: "", q: "" });
    setInactivityBand("");
    setProjectPhase("");
    setProjectStatus("");
    setProjectInterface(""); setProjectGroup(""); setProjectConfidence("");
  };

  const matrixCell = (row: string, column: string) => {
    if (!data?.matrix) return;
    const patch: Partial<DashboardFilters> = {};
    const map = (dimension: string, value: string) => {
      if (dimension === "category") patch.category = value;
      else if (dimension === "macroprocess") patch.macro = value;
      else if (dimension === "sector") patch.sector = value;
      else if (dimension === "status") patch.status = value;
      else if (dimension === "responsibility") patch.owner = RESPONSIBILITY_TO_OWNER[value] ?? value;
      else if (dimension === "age_band") setInactivityBand(value);
    };
    map(data.matrix.row_dimension, row);
    map(data.matrix.column_dimension, column);
    apply(patch);
  };

  const metrics = data?.metrics ?? undefined;
  const unavailable = Boolean(data && ["NÃO HOMOLOGADO", "FONTE NÃO INTEGRADA"].includes(data.status));
  const detailProps = { eyebrow: copy.common.drilldownEyebrow, title: copy.common.drilldownTitle };
  const projectStatusCount = (name: string) => asNumber(data?.statuses?.find((item) => item.name === name)?.value);
  const isProjects = kpi === 10;
  const exportProjects = () => {
    const rows = data?.records?.items ?? [];
    const headers = ["Projeto / Demanda", "Secretaria / Interface", "Grupo", "Fase atual", "Status atual", "Atividade atual", "Dependência / Bloqueio", "Data de referência", "Confiança"];
    const safe = (value: unknown) => {
      const text = String(value ?? "").replace(/[\r\n]+/g, " ");
      const neutralized = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${neutralized.replace(/"/g, '""')}"`;
    };
    const content = [headers, ...rows.map((row) => [row.Projeto, row.Interface, row.Grupo, row.FaseAtual, row.StatusAtual, row.current_activity, row.blocker, row.DataReferencia, row.Confianca])].map((row) => row.map(safe).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "SEPLANBI_PROJETOS_PUBLICOS_RECORTE.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="bi-page extended-bi" data-panel={`kpi${String(kpi).padStart(2, "0")}`}>
      <nav className="drill-breadcrumb" aria-label={isProjects ? "Caminho da carteira" : "Caminho do indicador"}><span>{copy.common.breadcrumbOverview}</span>{!isProjects ? <span>{copy.common.breadcrumbIndicators}</span> : null}<span>{currentCopy.title}</span>{!isProjects && filters.category ? <span>Categoria: {filters.category}</span> : null}{!isProjects && filters.status ? <span>Status: {filters.status}</span> : null}</nav>
      <header className="page-hero bi-hero"><div><span className="eyebrow">{currentCopy.eyebrow}</span><h1>{currentCopy.title}</h1><p>{currentCopy.description}</p>{isProjects && metrics ? <small className="portfolio-source">Fonte: Controle de Projetos SEPLAN · {formatDate(String(read(metrics, "reference_date") ?? ""))}<br />{formatNumber(asNumber(read(metrics, "projects")))} projetos</small> : null}</div><div className="bi-page-actions"><span className={`status-badge ${data?.status === "DISPONÍVEL" ? "ok" : data?.status === "PARCIAL" ? "partial" : "off"}`}>{data?.status ?? "CARREGANDO"}</span><button className="ghost-button" onClick={clear}>Limpar seleção</button></div></header>
      {error ? <div className="error-panel" role="alert"><div><strong>Falha ao carregar o indicador.</strong><p>{error}</p></div></div> : null}
      {loading && !data ? <div className="loading-screen"><span className="loading-mark" /><div><strong>{copy.common.loadingTitle}</strong><p>{copy.common.loadingDescription}</p></div></div> : null}
      {unavailable ? <section className="panel unavailable"><span className="eyebrow">{copy.common.hardGateEyebrow}</span><h2>{copy.common.hardGateTitle}</h2><p>{data?.reason}</p>{data?.rule ? <div className="management-note"><strong>{copy.common.ruleLabel}</strong><p>{data.rule}</p></div> : null}{data?.context ? <div className="management-note"><strong>Contexto disponível</strong><p>{Object.entries(data.context).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</p></div> : null}</section> : null}

      {data && kpi === 4 && metrics ? <>
        <section className="bi-metric-grid four"><MetricTile label="Mediana" value={formatDays(asNumber(read(metrics, "median_days")))} detail="KPI principal" tone="purple" /><MetricTile label="Média" value={formatDays(asNumber(read(metrics, "mean_days")))} detail="Sensível à cauda longa" /><MetricTile label="P90" value={formatDays(asNumber(read(metrics, "p90_days")))} detail="90% concluem até" tone="orange" /><MetricTile label="Amostra" value={formatNumber(asNumber(read(metrics, "eligible")))} detail="saídas elegíveis" /></section>
        <section className="bi-layout-main"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi04.evolutionEyebrow}</span><h2>{copy.kpi04.evolutionTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.monthly, "median_days")} onSelect={(item) => toggle("month", String(Number(item.key.slice(5, 7))))} tone="teal" initialLimit={12} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi04.distributionEyebrow}</span><h2>{copy.kpi04.distributionTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.bands)} onSelect={() => undefined} tone="orange" initialLimit={10} /></article></section>
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi04.categoryEyebrow}</span><h2>{copy.kpi04.categoryTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.categories, "median_days")} selected={filters.category} onSelect={(item) => toggle("category", item.key)} tone="teal" initialLimit={12} /></article><DetailTable records={data.records} {...detailProps} />
      </> : null}

      {data && kpi === 5 && metrics ? <>
        <section className="bi-metric-grid four"><MetricTile label={`Parados > ${data.threshold_days ?? 30} dias`} value={formatNumber(asNumber(read(metrics, "stopped")))} tone="red" /><MetricTile label="% da fila interna" value={formatPercent(asNumber(read(metrics, "percent")))} tone="red" /><MetricTile label="Fila interna" value={formatNumber(asNumber(read(metrics, "internal_queue")))} detail="denominador" /><MetricTile label="Elegíveis" value={formatNumber(asNumber(read(metrics, "eligible")))} /></section>
        <section className="bi-layout-main"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi05.ageEyebrow}</span><h2>{copy.kpi05.ageTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.bands)} selected={inactivityBand} onSelect={(item) => setInactivityBand(inactivityBand === item.key ? "" : item.key)} tone="red" /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi05.categoryEyebrow}</span><h2>{copy.kpi05.categoryTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.categories)} selected={filters.category} onSelect={(item) => toggle("category", item.key)} tone="orange" initialLimit={12} /></article></section>
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi05.sectorEyebrow}</span><h2>{copy.kpi05.sectorTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.sectors)} selected={filters.sector} onSelect={(item) => toggle("sector", item.key)} tone="teal" initialLimit={12} /></article><DetailTable records={data.records} {...detailProps} />
      </> : null}

      {data && kpi === 7 && metrics ? <><section className="bi-metric-grid four"><MetricTile label="Eventos de diligência" value={formatNumber(asNumber(read(metrics, "diligence_events")))} /><MetricTile label="Protocolos afetados" value={formatNumber(asNumber(read(metrics, "protocols_with_diligence")))} /><MetricTile label="Média por afetado" value={String(read(metrics, "average_per_affected_protocol") ?? "0")} /><MetricTile label="3+ diligências" value={formatNumber(asNumber(read(metrics, "protocols_3_plus")))} tone="orange" /></section><section className="bi-layout-main"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi07.distributionEyebrow}</span><h2>{copy.kpi07.distributionTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.distribution)} onSelect={() => undefined} tone="orange" /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi07.categoryEyebrow}</span><h2>{copy.kpi07.categoryTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.categories)} selected={filters.category} onSelect={(item) => toggle("category", item.key)} tone="teal" initialLimit={12} /></article></section><div className="management-note"><strong>{copy.kpi07.coverageTitle}</strong><p>{String(read(data.coverage, "limitation") ?? "Histórico incremental disponível.")}</p></div><DetailTable records={data.records} {...detailProps} /></> : null}

      {data && kpi === 9 && metrics ? <><section className="bi-metric-grid five"><MetricTile label="Recebidas" value={formatNumber(asNumber(read(metrics, "received")))} /><MetricTile label="Respondidas / saídas" value={formatNumber(asNumber(read(metrics, "responded")))} tone="green" /><MetricTile label="Estoque atual" value={formatNumber(asNumber(read(metrics, "current_stock")))} tone="orange" /><MetricTile label="% respondido" value={formatPercent(asNumber(read(metrics, "response_rate_percent")))} /><MetricTile label="Mediana de resposta" value={formatDays(asNumber(read(asObject(read(metrics, "response_time")), "median_days")))} tone="purple" /></section><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi09.statusEyebrow}</span><h2>{copy.kpi09.statusTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.statuses)} selected={filters.status} onSelect={(item) => toggle("status", item.key)} tone="orange" /></article><DetailTable records={data.records} {...detailProps} /></> : null}

      {data && kpi === 10 && metrics ? <><section className="projects-filter-bar" aria-label="Filtros de Projetos Públicos"><label><span>Secretaria / Interface</span><select value={projectInterface} onChange={(event) => setProjectInterface(event.target.value)}><option value="">Todas</option>{(data.interfaces ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label><span>Fase</span><select value={projectPhase} onChange={(event) => setProjectPhase(event.target.value)}><option value="">Todas</option>{(data.phases ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label><span>Status</span><select value={projectStatus} onChange={(event) => setProjectStatus(event.target.value)}><option value="">Todos</option>{(data.statuses ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label><span>Grupo</span><select value={projectGroup} onChange={(event) => setProjectGroup(event.target.value)}><option value="">Todos</option>{(data.groups ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label><span>Confiança</span><select value={projectConfidence} onChange={(event) => setProjectConfidence(event.target.value)}><option value="">Todas</option>{(data.confidences ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label className="projects-search"><span>Pesquisar projeto</span><input type="search" value={filters.q} onChange={(event) => apply({ q: event.target.value })} placeholder="Nome, secretaria ou grupo" /></label><div className="projects-filter-actions"><button type="button" className="ghost-button" onClick={clear}>Limpar</button><button type="button" className="primary-button" onClick={exportProjects} disabled={!data.records?.items.length}>Exportar recorte</button></div></section><section className="bi-metric-grid five"><MetricTile label="Quantidade de Projetos" value={formatNumber(asNumber(read(metrics, "projects")))} detail="carteira total" tone="blue" /><MetricTile label="Em andamento" value={formatNumber(projectStatusCount("Em andamento"))} tone="green" /><MetricTile label="Aguardando / ação necessária" value={formatNumber(projectStatusCount("Aguardando decisão/retorno") + projectStatusCount("Ação necessária"))} tone="orange" /><MetricTile label="Paralisados" value={formatNumber(projectStatusCount("Paralisado"))} tone="red" /><MetricTile label="Não iniciados" value={formatNumber(projectStatusCount("Não iniciado"))} tone="slate" /></section><section className="bi-layout-main"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi10.phaseEyebrow}</span><h2>{copy.kpi10.phaseTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.phases)} selected={projectPhase} onSelect={(item) => setProjectPhase(projectPhase === item.key ? "" : item.key)} tone="blue" initialLimit={20} emptyLabel="Sem projetos neste recorte." /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi10.statusEyebrow}</span><h2>{copy.kpi10.statusTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.statuses)} selected={projectStatus} onSelect={(item) => setProjectStatus(projectStatus === item.key ? "" : item.key)} tone="teal" initialLimit={20} emptyLabel="Sem projetos neste recorte." /></article></section><section className="bi-layout-main"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">INTERFACE</span><h2>Projetos por Secretaria / Interface</h2></div></div><InteractiveBars items={rowsToVisuals(data.interfaces)} selected={projectInterface} onSelect={(item) => setProjectInterface(projectInterface === item.key ? "" : item.key)} tone="blue" initialLimit={12} emptyLabel="Sem projetos neste recorte." /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">GRUPO</span><h2>Composição da carteira</h2></div></div><InteractiveBars items={rowsToVisuals(data.groups)} selected={projectGroup} onSelect={(item) => setProjectGroup(projectGroup === item.key ? "" : item.key)} tone="teal" initialLimit={12} emptyLabel="Sem projetos neste recorte." /></article></section><DetailTable records={data.records} {...detailProps} /></> : null}

      {data && kpi === 11 && metrics ? <><section className="bi-metric-grid four"><MetricTile label="Pendências" value={formatNumber(asNumber(read(metrics, "stock")))} tone="orange" /><MetricTile label="Internas SEPLAN" value={formatNumber(asNumber(read(metrics, "internal")))} /><MetricTile label="Responsável externo" value={formatNumber(asNumber(read(metrics, "external")))} /><MetricTile label="Paralisadas" value={formatNumber(asNumber(read(metrics, "paralyzed")))} tone="red" /></section><section className="bi-layout-main"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi11.responsibilityEyebrow}</span><h2>{copy.kpi11.responsibilityTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.responsibilities)} selected={filters.owner ? OWNER_TO_RESPONSIBILITY[filters.owner] : ""} onSelect={(item) => toggle("owner", RESPONSIBILITY_TO_OWNER[item.key] ?? item.key)} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">{copy.kpi11.sectorEyebrow}</span><h2>{copy.kpi11.sectorTitle}</h2></div></div><InteractiveBars items={rowsToVisuals(data.sectors)} selected={filters.sector} onSelect={(item) => toggle("sector", item.key)} tone="teal" initialLimit={12} /></article></section><article className="panel"><div className="panel-heading matrix-heading"><div><span className="eyebrow">{copy.kpi11.matrixEyebrow}</span><h2>{copy.kpi11.matrixTitle}</h2></div><div className="matrix-controls"><select value={rowDimension} onChange={(event) => setRowDimension(event.target.value)}><option value="category">Categoria</option><option value="macroprocess">Família de Processos</option><option value="sector">Setor de tramitação</option><option value="responsibility">Responsabilidade</option><option value="status">Status</option></select><span>×</span><select value={columnDimension} onChange={(event) => setColumnDimension(event.target.value)}><option value="status">Status</option><option value="age_band">Faixa de idade</option><option value="responsibility">Responsabilidade</option><option value="category">Categoria</option><option value="sector">Setor de tramitação</option></select></div></div>{data.matrix ? <Matrix data={data.matrix} onCell={matrixCell} /> : null}</article><DetailTable records={data.records} {...detailProps} /></> : null}
    </section>
  );
}
