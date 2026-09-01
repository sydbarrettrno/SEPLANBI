import { useEffect, useMemo, useState } from "react";
import { useDashboardContent } from "../content/DashboardContentContext";
import { flattenDashboardCopy, setDashboardCopyValue, type EditableCopyField } from "../content/dashboardCopy";
import { PrivateExportButton } from "./PrivateExportButton";
import "../admin-content.css";

const COMPONENT_LABELS: Record<string, string> = {
  header: "Cabeçalho da página",
  cards: "Cards executivos",
  flow: "Gráfico de fluxo mensal",
  signals: "Sinais do período",
  internalAging: "Tempo sem movimentação",
  responsibility: "Pendências por responsável",
  metrics: "Métricas",
  monthly: "Gráfico mensal",
  macro: "Macroprocessos",
  category: "Categorias",
  reading: "Leitura executiva",
  composition: "Composição",
  balanceEvolution: "Evolução do saldo",
  age: "Idade",
  gargles: "Gargalos",
  concentration: "Concentração",
  status: "Status",
  details: "Detalhes de protocolos",
  items: "Itens",
  common: "Textos comuns",
};

const ITEM_LABELS: Record<string, string> = {
  overview: "Visão executiva",
  received: "Recebidos",
  outputs: "Finalizados / Saídas",
  balance: "Saldo",
  stock: "Estoque",
  time: "Tempo de tramitação",
  processes: "Protocolos",
  indicators: "Indicadores",
  admin: "Administração",
  all: "Todos os protocolos",
  concluded: "Finalizados",
  stopped: "Processos parados",
  external: "Responsável externo",
  paralyzed: "Paralisados",
  KPI01: "Indicador 01",
  KPI02: "Indicador 02",
  KPI03: "Indicador 03",
  KPI04: "Indicador 04",
  KPI05: "Indicador 05",
  KPI06: "Indicador 06",
  KPI07: "Indicador 07",
  KPI08: "Indicador 08",
  KPI09: "Indicador 09",
  KPI10: "Indicador 10",
  KPI11: "Indicador 11",
};

function componentId(field: EditableCopyField) {
  const parts = field.path.split(".");
  if (parts.length <= 2) return "header";
  const parent = parts[1];
  if (["cards", "items", "details"].includes(parent) && parts[2]) return `${parent}:${parts[2]}`;
  return parent;
}

function componentLabel(id: string) {
  const [group, item] = id.split(":");
  if (!item) return COMPONENT_LABELS[group] ?? group;
  const groupName = group === "cards" ? "Card" : group === "items" ? "Item" : "Detalhe";
  return `${groupName} · ${ITEM_LABELS[item] ?? item}`;
}

function Preview({ field, value, page, component }: { field: EditableCopyField; value: string; page: string; component: string }) {
  const card = field.path.includes(".cards.");
  const menu = field.path.startsWith("sidebar.");
  return (
    <div className={`admin-preview-card ${card ? "is-card" : ""} ${menu ? "is-menu" : ""}`}>
      <small>Pré-visualização · {page}</small>
      <strong>{component}</strong>
      <p>{value || "(campo vazio)"}</p>
    </div>
  );
}

export function AdminDescriptions() {
  const { copy, defaults, persistent, updatedAt, save } = useDashboardContent();
  const [page, setPage] = useState("Visão executiva");
  const [component, setComponent] = useState("");
  const [fieldPath, setFieldPath] = useState("");
  const [editValue, setEditValue] = useState("");
  const [previewValue, setPreviewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const fields = useMemo(() => flattenDashboardCopy(copy), [copy]);
  const defaultFields = useMemo(() => flattenDashboardCopy(defaults), [defaults]);
  const pages = useMemo(() => Array.from(new Set(fields.map((field) => field.section))), [fields]);
  const pageFields = useMemo(() => fields.filter((field) => field.section === page), [fields, page]);
  const components = useMemo(() => {
    const unique = Array.from(new Set(pageFields.map(componentId)));
    return unique.map((id) => ({ id, label: componentLabel(id) }));
  }, [pageFields]);
  const componentFields = useMemo(
    () => pageFields.filter((field) => componentId(field) === component),
    [component, pageFields],
  );
  const selected = useMemo(
    () => componentFields.find((field) => field.path === fieldPath) ?? componentFields[0] ?? null,
    [componentFields, fieldPath],
  );

  useEffect(() => {
    if (!pages.includes(page)) setPage(pages[0] ?? "");
  }, [page, pages]);

  useEffect(() => {
    if (!components.some((item) => item.id === component)) setComponent(components[0]?.id ?? "");
  }, [component, components]);

  useEffect(() => {
    if (!selected) {
      setFieldPath("");
      setEditValue("");
      setPreviewValue("");
      return;
    }
    setFieldPath(selected.path);
    setEditValue(selected.value);
    setPreviewValue(selected.value);
    setFeedback(null);
  }, [selected?.path, selected?.value]);

  const changed = Boolean(selected && editValue !== selected.value);
  const selectedComponentLabel = componentLabel(component || "header");
  const defaultValue = selected ? defaultFields.find((field) => field.path === selected.path)?.value ?? selected.value : "";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !changed) {
      setFeedback({ tone: "error", text: "Nenhuma alteração foi feita neste campo." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const next = setDashboardCopyValue(copy, selected.path, editValue);
      await save(next);
      setPreviewValue(editValue);
      setFeedback({ tone: "success", text: "Alteração publicada com sucesso." });
    } catch (reason) {
      setFeedback({ tone: "error", text: reason instanceof Error ? reason.message : "Não foi possível salvar a alteração." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-page">
      <div className="page-hero simple-hero">
        <div>
          <span className="eyebrow">{copy.admin.eyebrow}</span>
          <h1>{copy.admin.title}</h1>
          <p>Escolha a página, o componente e o campo que deseja editar. Apenas o campo selecionado será publicado.</p>
        </div>
        <span className={persistent ? "live-pill" : "prototype-pill"}>{persistent ? "Persistência ativa" : "Armazenamento pendente"}</span>
      </div>

      <section className="panel admin-export-card" aria-labelledby="admin-export-title">
        <div className="admin-export-icon" aria-hidden="true">▣</div>
        <div className="admin-export-copy">
          <span className="eyebrow">ARQUIVO ADMINISTRATIVO</span>
          <h2 id="admin-export-title">Exportar base completa</h2>
          <p>Gera a última versão da base disponível no sistema em XLSX, incluindo dados privados autorizados, resumo do dashboard e abas com a memória de cálculo dos indicadores.</p>
        </div>
        <PrivateExportButton label="Exportar XLSX" className="primary-button admin-export-button" />
      </section>

      <div className="admin-grid">
        <form className="panel admin-form admin-editor-shell" onSubmit={submit}>
          <div className="panel-heading">
            <div><span className="eyebrow">CONTEÚDO EDITORIAL</span><h2>Editar um campo</h2><p>Página → componente → campo → pré-visualização → salvar.</p></div>
          </div>

          <div className="admin-selector-grid">
            <label>
              <span>Página</span>
              <select value={page} onChange={(event) => { setPage(event.target.value); setComponent(""); setFieldPath(""); }}>
                {pages.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Componente</span>
              <select value={component} onChange={(event) => { setComponent(event.target.value); setFieldPath(""); }}>
                {components.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span>Campo</span>
              <select value={selected?.path ?? ""} onChange={(event) => setFieldPath(event.target.value)}>
                {componentFields.map((field) => <option key={field.path} value={field.path}>{field.label}</option>)}
              </select>
            </label>
          </div>

          {selected ? (
            <>
              <div className="admin-current-value">
                <span>Valor atualmente publicado</span>
                <p>{selected.value || "(campo vazio)"}</p>
              </div>

              <div className="admin-edit-field">
                <label>
                  <span>Novo valor · {editValue.length}/600</span>
                  <textarea
                    value={editValue}
                    maxLength={600}
                    onChange={(event) => { setEditValue(event.target.value); setFeedback(null); }}
                  />
                </label>
              </div>

              <Preview field={selected} value={previewValue} page={page} component={selectedComponentLabel} />

              <div className="admin-diff" aria-label="Comparação da alteração">
                <div><span>Publicado</span><p>{selected.value || "(vazio)"}</p></div>
                <div><span>Novo</span><p>{editValue || "(vazio)"}</p></div>
              </div>

              <div className="admin-publish-row">
                <div>
                  <strong>Somente este campo será alterado</strong>
                  <span>Dados, fórmulas, classificação e regras dos indicadores permanecem intocados.</span>
                </div>
                <div className="admin-inline-actions">
                  <button className="ghost-button" type="button" onClick={() => setPreviewValue(editValue)}>Visualizar</button>
                  <button className="primary-button" type="submit" disabled={saving || !changed}>{saving ? "Salvando…" : "Salvar alteração"}</button>
                </div>
              </div>

              <div className="admin-actions">
                <button className="ghost-button" type="button" onClick={() => { setEditValue(defaultValue); setPreviewValue(defaultValue); setFeedback(null); }}>Usar valor padrão</button>
                <button className="ghost-button" type="button" disabled={!changed} onClick={() => { setEditValue(selected.value); setPreviewValue(selected.value); setFeedback(null); }}>Descartar</button>
                <span>{updatedAt ? `Última publicação: ${new Date(updatedAt).toLocaleString("pt-BR")}` : "Nenhuma publicação editorial registrada."}</span>
              </div>
            </>
          ) : <p className="admin-feedback error">Nenhum campo editorial disponível nesta seleção.</p>}

          {feedback ? <p className={`admin-feedback ${feedback.tone}`} role="status">{feedback.text}</p> : null}
        </form>

        <aside className="panel admin-boundary">
          <span className="eyebrow">{copy.admin.securityEyebrow}</span>
          <h2>{copy.admin.securityTitle}</h2>
          <p>{copy.admin.securityText}</p>
          <ul>
            <li>cada publicação altera apenas o campo selecionado;</li>
            <li>nenhum identificador interno é exibido nesta tela;</li>
            <li>dados e regras de negócio não são editáveis aqui;</li>
            <li>a autorização é validada no servidor;</li>
            <li>a exportação exige nova confirmação de senha;</li>
            <li>a sessão expira automaticamente.</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
