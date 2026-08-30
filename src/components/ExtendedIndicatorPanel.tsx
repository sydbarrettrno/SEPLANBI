import { useEffect, useMemo, useState } from "react";
import { fetchExtendedIndicator } from "../api";
import type { ExtendedKpi, ExtendedNamedValue, ExtendedRecord, ExtendedResponse } from "../extended";
import { formatDays, formatNumber, formatPercent } from "../format";
import type { DashboardFilters } from "../types";
import { InteractiveBars, MetricTile, type VisualItem } from "./BiVisuals";

interface Props {
  kpi: ExtendedKpi;
  filters: DashboardFilters;
  onFilters: (filters: DashboardFilters) => void;
}

const COPY: Record<ExtendedKpi, { eyebrow: string; title: string; description: string }> = {
  4: { eyebrow: "INDICADOR 04 · TEMPO", title: "Tempo de tramitação", description: "Mediana como leitura principal, média e P90 como contexto; investigue mês, categoria e protocolos." },
  5: { eyebrow: "INDICADOR 05 · GARGALO", title: "Processos parados", description: "Somente a fila interna da SEPLAN entra no denominador; esperas externas e paralisados ficam fora." },
  6: { eyebrow: "INDICADOR 06 · SLA", title: "Concluídos dentro do prazo", description: "Este indicador só é liberado quando houver regra oficial de prazo por categoria." },
  7: { eyebrow: "INDICADOR 07 · RETORNOS", title: "Diligências por processo", description: "Cobertura incremental dos eventos disponíveis, sem apresentar o extrato como histórico integral." },
  8: { eyebrow: "INDICADOR 08 · FISCALIZAÇÃO", title: "Fiscalizações realizadas", description: "Nenhum protocolo é contado como ato realizado sem evidência auditada de fiscalização ou vistoria." },
  9: { eyebrow: "INDICADOR 09 · DENÚNCIAS", title: "Denúncias recebidas e respondidas", description: "Volume recebido, saídas, estoque e tempo de resposta da categoria homologada Denúncia." },
  10: { eyebrow: "INDICADOR 10 · PROJETOS", title: "Projetos públicos por etapa", description: "Carteira específica de projetos, com referência 27/08/2026; protocolos IPM não são usados como proxy." },
  11: { eyebrow: "INDICADOR 11 · RESPONSABILIDADE", title: "Pendências por responsável / setor", description: "Concentração operacional por responsabilidade, setor e categoria, com matriz dinâmica e drill-down." },
};

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

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function objectValue(source: Record<string, unknown> | null | undefined, key: string): unknown {
  return source?.[key];
}

function nestedObject(source: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | undefined {
  const value = source?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function visuals(rows: ExtendedNamedValue[] | undefined): VisualItem[] {
  return (rows ?? []).map((item) => ({ key: item.name, label: item.name, value: item.value }));
}

function statVisuals(rows: Array<Record<string, unknown>> | undefined, key: string): VisualItem[] {
  return (rows ?? []).map((item) => ({
    key: String(item.name ?? "Não informado"),
    label: String(item.name ?? "Não informado"),
    value: asNumber(item[key]),
    context: `n=${formatNumber(asNumber(item.eligible))}`,
  }));
}

function DetailTable({ records }: { records: ExtendedResponse["records"] }) {
  if (!records) return null;
  return (
    <article className="panel table-panel extended-detail">
      <div className="table-toolbar"><div><span className="eyebrow">DRILL-DOWN AUDITÁVEL</span><h2>Registros que compõem o número</h2><p data-record-count={records.total}>{formatNumber(records.total)} registros no cruzamento ativo.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Protocolo / ID</th><th>Abertura / referência</th><th>Categoria / fase</th><th>Status</th><th>Setor</th><th>Dias</th></tr></thead><tbody>
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
  const [data, setData] = useState<ExtendedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inactivityBand, setInactivityBand] = useState("");
  const [projectPhase, setProjectPhase] = useState("");
  const [projectStatus, setProjectStatus] = useState("");
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
    rowDimension,
    columnDimension,
    q: filters.q,
    limit: 100,
  }), [filters, inactivityBand, kpi, projectPhase, projectStatus, rowDimension, columnDimension]);

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

  const copy = COPY[kpi];
  const apply = (patch: Partial<DashboardFilters>) => onFilters({ ...filters, ...patch, offset: 0 });
  const toggle = (field: keyof DashboardFilters, value: string) => apply({ [field]: filters[field] === value ? "" : value } as Partial<DashboardFilters>);
  const clear = () => {
    apply({ month: "", macro: "", category: "", status: "", owner: "", sector: "", q: "" });
    setInactivityBand(""); setProjectPhase(""); setProjectStatus("");
  };

  const matrixCell = (row: string, column: string) => {
    if (!data?.matrix) return;
    const patch: Partial<DashboardFilters> = {};
    const mapDimension = (dimension: string, value: string) => {
      if (dimension === "category") patch.category = value;
      else if (dimension === "macroprocess") patch.macro = value;
      else if (dimension === "sector") patch.sector = value;
      else if (dimension === "status") patch.status = value;
      else if (dimension === "responsibility") patch.owner = RESPONSIBILITY_TO_OWNER[value] ?? value;
      else if (dimension === "age_band") setInactivityBand(value);
    };
    mapDimension(data.matrix.row_dimension, row);
    mapDimension(data.matrix.column_dimension, column);
    apply(patch);
  };

  const metrics = data?.metrics;
  const unavailable = data && ["NÃO HOMOLOGADO", "FONTE NÃO INTEGRADA"].includes(data.status);

  return (
    <section className="bi-page extended-bi" data-panel={`kpi${String(kpi).padStart(2, "0")}`}>
      <nav className="drill-breadcrumb" aria-label="Caminho do indicador"><span>Visão executiva</span><span>Indicadores</span><span>{copy.title}</span>{filters.category ? <span>Categoria: {filters.category}</span> : null}{filters.status ? <span>Status: {filters.status}</span> : null}</nav>
      <header className="page-hero bi-hero"><div><span className="eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.description}</p></div><div className="bi-page-actions"><span className={`status-badge ${data?.status === "DISPONÍVEL" ? "ok" : data?.status === "PARCIAL" ? "partial" : "off"}`}>{data?.status ?? "CARREGANDO"}</span><button className="ghost-button" onClick={clear}>Limpar seleção</button></div></header>
      {error ? <div className="error-panel" role="alert"><div><strong>Falha ao carregar o indicador.</strong><p>{error}</p></div></div> : null}
      {loading && !data ? <div className="loading-screen"><span className="loading-mark" /><div><strong>Reconciliando indicador</strong><p>Aplicando os filtros sobre a base validada…</p></div></div> : null}
      {unavailable ? <section className="panel unavailable"><span className="eyebrow">HARD GATE</span><h2>Indicador não publicado como número</h2><p>{data?.reason}</p>{data?.rule ? <div className="management-note"><strong>Regra</strong><p>{data.rule}</p></div> : null}{data?.context ? <pre className="indicator-context">{JSON.stringify(data.context, null, 2)}</pre> : null}</section> : null}

      {data && kpi === 4 && metrics ? <>
        <section className="bi-metric-grid four"><MetricTile label="Mediana" value={formatDays(asNumber(objectValue(metrics, "median_days")))} detail="KPI principal" tone="purple" /><MetricTile label="Média" value={formatDays(asNumber(objectValue(metrics, "mean_days")))} detail="Sensível à cauda longa" /><MetricTile label="P90" value={formatDays(asNumber(objectValue(metrics, "p90_days")))} detail="90% concluem até" tone="orange" /><MetricTile label="Amostra" value={formatNumber(asNumber(objectValue(metrics, "eligible")))} detail="saídas elegíveis" /></section>
        <section className="bi-layout-main"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">EVOLUÇÃO</span><h2>Mediana por mês de saída</h2></div></div><InteractiveBars items={statVisuals(data.monthly, "median_days")} selected={filters.month ? data.monthly?.find((item) => String(item.name).endsWith(`-${filters.month.padStart(2, "0")}`))?.name as string : ""} onSelect={(item) => toggle("month", String(Number(item.key.slice(5, 7))))} tone="teal" initialLimit={12} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">DISTRIBUIÇÃO</span><h2>Faixas de tramitação</h2></div></div><InteractiveBars items={visuals(data.bands)} onSelect={() => undefined} tone="orange" initialLimit={10} /></article></section>
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">CATEGORIAS</span><h2>Mediana por categoria</h2></div></div><InteractiveBars items={statVisuals(data.categories as Array<Record<string, unknown>>, "median_days")} selected={filters.category} onSelect={(item) => toggle("category", item.key)} tone="purple" initialLimit={12} /></article>
        <DetailTable records={data.records} />
      </> : null}

      {data && kpi === 5 && metrics ? <>
        <section className="bi-metric-grid four"><MetricTile label={`Parados > ${data.threshold_days ?? 30} dias`} value={formatNumber(asNumber(objectValue(metrics, "stopped")))} tone="red" /><MetricTile label="% da fila interna" value={formatPercent(asNumber(objectValue(metrics, "percent")))} tone="red" /><MetricTile label="Fila interna" value={formatNumber(asNumber(objectValue(metrics, "internal_queue")))} detail="denominador" /><MetricTile label="Elegíveis" value={formatNumber(asNumber(objectValue(metrics, "eligible")))} /></section>
        <section className="bi-layout-main"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">IDADE SEM MOVIMENTO</span><h2>Fila interna</h2></div></div><InteractiveBars items={visuals(data.bands)} selected={inactivityBand} onSelect={(item) => setInactivityBand(inactivityBand === item.key ? "" : item.key)} tone="red" /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">GARGALO</span><h2>Parados por categoria</h2></div></div><InteractiveBars items={visuals(data.categories)} selected={filters.category} onSelect={(item) => toggle("category", item.key)} tone="orange" initialLimit={12} /></article></section>
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">SETOR</span><h2>Parados por setor</h2></div></div><InteractiveBars items={visuals(data.sectors)} selected={filters.sector} onSelect={(item) => toggle("sector", item.key)} tone="teal" initialLimit={12} /></article><DetailTable records={data.records} />
      </> : null}

      {data && kpi === 7 && data.metrics ? <>
        <section className="bi-metric-grid four"><MetricTile label="Eventos de diligência" value={formatNumber(asNumber(objectValue(data.metrics, "diligence_events")))} /><MetricTile label="Protocolos afetados" value={formatNumber(asNumber(objectValue(data.metrics, "protocols_with_diligence")))} /><MetricTile label="Média por afetado" value={String(objectValue(data.metrics, "average_per_affected_protocol") ?? "0")} /><MetricTile label="3+ diligências" value={formatNumber(asNumber(objectValue(data.metrics, "protocols_3_plus")))} tone="orange" /></section><section className="bi-layout-main"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">REINCIDÊNCIA</span><h2>Diligências por protocolo</h2></div></div><InteractiveBars items={visuals(data.distribution)} onSelect={() => undefined} tone="orange" /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">CATEGORIA</span><h2>Protocolos com diligência</h2></div></div><InteractiveBars items={visuals(data.categories)} selected={filters.category} onSelect={(item) => toggle("category", item.key)} tone="teal" initialLimit={12} /></article></section><div className="management-note"><strong>Cobertura parcial</strong><p>{String(objectValue(data.coverage, "limitation") ?? "Histórico incremental disponível.")}</p></div><DetailTable records={data.records} /></> : null}

      {data && kpi === 9 && metrics ? <>
        <section className="bi-metric-grid five"><MetricTile label="Recebidas" value={formatNumber(asNumber(objectValue(metrics, "received")))} /><MetricTile label="Respondidas / saídas" value={formatNumber(asNumber(objectValue(metrics, "responded")))} tone="green" /><MetricTile label="Estoque atual" value={formatNumber(asNumber(objectValue(metrics, "current_stock")))} tone="orange" /><MetricTile label="% respondido" value={formatPercent(asNumber(objectValue(metrics, "response_rate_percent")))} /><MetricTile label="Mediana de resposta" value={formatDays(asNumber(objectValue(nestedObject(metrics, "response_time"), "median_days")))} tone="purple" /></section><article className="panel"><div className="panel-heading"><div><span className="eyebrow">STATUS ATUAL</span><h2>Denúncias em estoque</h2></div></div><InteractiveBars items={visuals(data.statuses)} selected={filters.status} onSelect={(item) => toggle("status", item.key)} tone="orange" /></article><DetailTable records={data.records} /></> : null}

      {data && kpi === 10 && metrics ? <>
        <section className="bi-metric-grid three"><MetricTile label="Projetos" value={formatNumber(asNumber(objectValue(metrics, "projects")))} tone="blue" /><MetricTile label="Selecionados" value={formatNumber(asNumber(objectValue(metrics, "selected")))} /><MetricTile label="Data de referência" value={String(objectValue(metrics, "reference_date") ?? "—")} tone="slate" /></section><section className="bi-layout-main"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">PIPELINE</span><h2>Projetos por etapa</h2></div></div><InteractiveBars items={visuals(data.phases)} selected={projectPhase} onSelect={(item) => setProjectPhase(projectPhase === item.key ? "" : item.key)} tone="blue" initialLimit={20} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">STATUS</span><h2>Carteira por situação</h2></div></div><InteractiveBars items={visuals(data.statuses)} selected={projectStatus} onSelect={(item) => setProjectStatus(projectStatus === item.key ? "" : item.key)} tone="teal" initialLimit={20} /></article></section><DetailTable records={data.records} /></> : null}

      {data && kpi === 11 && metrics ? <>
        <section className="bi-metric-grid four"><MetricTile label="Pendências" value={formatNumber(asNumber(objectValue(metrics, "stock")))} tone="orange" /><MetricTile label="Internas SEPLAN" value={formatNumber(asNumber(objectValue(metrics, "internal")))} /><MetricTile label="Responsável externo" value={formatNumber(asNumber(objectValue(metrics, "external")))} /><MetricTile label="Paralisadas" value={formatNumber(asNumber(objectValue(metrics, "paralyzed")))} tone="red" /></section><section className="bi-layout-main"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">RESPONSABILIDADE</span><h2>De quem depende o próximo movimento?</h2></div></div><InteractiveBars items={visuals(data.responsibilities)} selected={filters.owner ? OWNER_TO_RESPONSIBILITY[filters.owner] : ""} onSelect={(item) => toggle("owner", RESPONSIBILITY_TO_OWNER[item.key] ?? item.key)} /></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">SETOR</span><h2>Concentração atual</h2></div></div><InteractiveBars items={visuals(data.sectors)} selected={filters.sector} onSelect={(item) => toggle("sector", item.key)} tone="teal" initialLimit={12} /></article></section><article className="panel"><div className="panel-heading matrix-heading"><div><span className="eyebrow">MATRIZ DINÂMICA</span><h2>Cruze duas dimensões</h2></div><div className="matrix-controls"><select value={rowDimension} onChange={(event) => setRowDimension(event.target.value)}><option value="category">Categoria</option><option value="macroprocess">Macroprocesso</option><option value="sector">Setor</option><option value="responsibility">Responsabilidade</option><option value="status">Status</option></select><span>×</span><select value={columnDimension} onChange={(event) => setColumnDimension(event.target.value)}><option value="status">Status</option><option value="age_band">Faixa de idade</option><option value="responsibility">Responsabilidade</option><option value="category">Categoria</option><option value="sector">Setor</option></select></div></div>{data.matrix ? <Matrix data={data.matrix} onCell={matrixCell} /> : null}</article><DetailTable records={data.records} /></> : null}
    </section>
  );
}
