import { useEffect, useMemo, useState } from "react";
import { useDashboardContent } from "../content/DashboardContentContext";
import { cloneDashboardCopy, flattenDashboardCopy, setDashboardCopyValue, type DashboardCopy } from "../content/dashboardCopy";
import "../admin-content.css";

export function AdminDescriptions() {
  const { copy, defaults, persistent, updatedAt, save } = useDashboardContent();
  const [draft, setDraft] = useState<DashboardCopy>(() => cloneDashboardCopy(copy));
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("Todas");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => setDraft(cloneDashboardCopy(copy)), [copy]);

  const allFields = useMemo(() => flattenDashboardCopy(draft), [draft]);
  const sections = useMemo(() => ["Todas", ...Array.from(new Set(allFields.map((field) => field.section)))], [allFields]);
  const fields = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return allFields.filter((field) => {
      if (section !== "Todas" && field.section !== section) return false;
      if (!needle) return true;
      return `${field.section} ${field.label} ${field.path} ${field.value}`.toLocaleLowerCase("pt-BR").includes(needle);
    });
  }, [allFields, query, section]);

  const grouped = useMemo(() => {
    const result = new Map<string, typeof fields>();
    for (const field of fields) {
      const list = result.get(field.section) ?? [];
      list.push(field);
      result.set(field.section, list);
    }
    return Array.from(result.entries());
  }, [fields]);

  const changed = JSON.stringify(draft) !== JSON.stringify(copy);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setFeedback({ tone: "error", text: "Informe a senha de gravação." });
      return;
    }
    if (!changed) {
      setFeedback({ tone: "error", text: "Nenhum texto foi alterado." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await save(draft, password);
      setPassword("");
      setFeedback({ tone: "success", text: "Conteúdo editorial publicado. As páginas passam a usar estes textos sem alterar dados ou fórmulas." });
    } catch (reason) {
      setFeedback({ tone: "error", text: reason instanceof Error ? reason.message : "Não foi possível gravar." });
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
          <p>{copy.admin.description}</p>
        </div>
        <span className={persistent ? "live-pill" : "prototype-pill"}>{persistent ? "Persistência ativa" : "Armazenamento pendente"}</span>
      </div>

      <div className="admin-grid">
        <form className="panel admin-form" onSubmit={submit}>
          <div className="panel-heading">
            <div><span className="eyebrow">{copy.admin.formEyebrow}</span><h2>{copy.admin.formTitle}</h2><p>{allFields.length} campos editoriais centralizados.</p></div>
          </div>

          <div className="admin-password-row">
            <label>
              <span>Filtrar página/seção</span>
              <select value={section} onChange={(event) => setSection(event.target.value)}>
                {sections.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Buscar texto</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: estoque, sazonalidade, menu..." />
            </label>
          </div>

          {grouped.map(([group, groupFields]) => (
            <fieldset className="admin-content-group" key={group}>
              <legend>{group}</legend>
              {groupFields.map((field) => (
                <label key={field.path}>
                  <span>{field.label}</span>
                  <textarea
                    value={field.value}
                    maxLength={600}
                    rows={field.value.length > 140 ? 4 : 2}
                    onChange={(event) => setDraft((current) => setDashboardCopyValue(current, field.path, event.target.value))}
                  />
                  <small>{field.path} · {field.value.length}/600</small>
                </label>
              ))}
            </fieldset>
          ))}

          {!fields.length ? <p className="admin-feedback error">Nenhum campo corresponde ao filtro.</p> : null}

          <div className="admin-password-row">
            <label>
              <span>Senha de gravação</span>
              <input type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} placeholder="Informe a senha para publicar" />
            </label>
            <button className="primary-button" type="submit" disabled={saving || !changed}>{saving ? "Publicando…" : "Publicar textos"}</button>
          </div>

          {feedback ? <p className={`admin-feedback ${feedback.tone}`} role="status">{feedback.text}</p> : null}
          <div className="admin-actions">
            <button className="ghost-button" type="button" onClick={() => { setDraft(cloneDashboardCopy(defaults)); setFeedback(null); }}>Restaurar textos padrão</button>
            <button className="ghost-button" type="button" disabled={!changed} onClick={() => { setDraft(cloneDashboardCopy(copy)); setFeedback(null); }}>Descartar alterações</button>
            <span>{updatedAt ? `Última publicação: ${new Date(updatedAt).toLocaleString("pt-BR")}` : "Nenhuma publicação editorial registrada."}</span>
          </div>
        </form>

        <aside className="panel admin-boundary">
          <span className="eyebrow">{copy.admin.securityEyebrow}</span>
          <h2>{copy.admin.securityTitle}</h2>
          <p>{copy.admin.securityText}</p>
          <ul>
            <li>não altera fórmulas ou resultados;</li>
            <li>não altera categorias, status ou regras de classificação;</li>
            <li>não altera SLA nem transforma indicador não homologado em disponível;</li>
            <li>a gravação exige senha e mantém histórico técnico;</li>
            <li>os textos padrão continuam versionados no GitHub.</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
