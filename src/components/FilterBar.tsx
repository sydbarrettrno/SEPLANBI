import { useEffect, useMemo, useState } from "react";
import type { DashboardFilters, DashboardData } from "../types";
import { activeDashboardFilters } from "../analytics";
import {
  allFilterPresets,
  findPresetByCategoryValue,
  loadCustomFilterPresets,
  presetCategoryValue,
  saveCustomFilterPresets,
  type FilterPreset,
} from "../filterPresets";

interface FilterBarProps {
  filters: DashboardFilters;
  options?: DashboardData["options"];
  onApply: (filters: DashboardFilters) => void;
  loading: boolean;
}

function selectedValues(value: string): string[] {
  return value.split("|").map((item) => item.trim()).filter(Boolean);
}

export function FilterBar({ filters, options, onApply, loading }: FilterBarProps) {
  const [draft, setDraft] = useState(filters);
  const [open, setOpen] = useState(false);
  const [customPresets, setCustomPresets] = useState<FilterPreset[]>(() => loadCustomFilterPresets());
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDraft(filters);
        setOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [filters, open]);

  const update = (field: keyof DashboardFilters, value: string) => {
    setDraft((current) => ({ ...current, [field]: value, offset: 0 }));
  };

  const availableCategories = options?.categories ?? [];
  const explicitCategories = useMemo(() => selectedValues(draft.category), [draft.category]);
  const allCategoriesSelected = explicitCategories.length === 0;
  const categories = useMemo(
    () => allCategoriesSelected ? availableCategories : explicitCategories,
    [allCategoriesSelected, availableCategories, explicitCategories],
  );
  const categorySet = useMemo(() => new Set(categories), [categories]);
  const presets = useMemo(() => allFilterPresets(customPresets), [customPresets]);
  const activePreset = useMemo(() => findPresetByCategoryValue(draft.category), [draft.category, customPresets]);

  useEffect(() => {
    setSelectedPresetId(activePreset?.id ?? "");
  }, [activePreset?.id]);

  const toggleCategory = (category: string) => {
    setDraft((current) => {
      const currentValues = selectedValues(current.category);
      const selected = new Set(currentValues.length ? currentValues : availableCategories);

      if (selected.has(category)) {
        if (selected.size === 1) return current;
        selected.delete(category);
      } else {
        selected.add(category);
      }

      const nextValues = availableCategories.filter((value) => selected.has(value));
      const nextCategory = nextValues.length === availableCategories.length ? "" : nextValues.join("|");
      return { ...current, category: nextCategory, offset: 0 };
    });
  };

  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    const category = presetCategoryValue(preset, availableCategories);
    if (!category) return;
    setDraft((current) => ({ ...current, category, offset: 0 }));
  };

  const saveCurrentAsPreset = () => {
    const name = presetName.trim().slice(0, 48);
    if (!name || !categories.length) return;
    const id = `custom-${Date.now().toString(36)}`;
    const next: FilterPreset[] = [...customPresets, { id, name, categories: [...categories] }].slice(-20);
    setCustomPresets(next);
    saveCustomFilterPresets(next);
    setPresetName("");
    setSelectedPresetId(id);
  };

  const deleteCustomPreset = () => {
    if (!selectedPresetId) return;
    const selected = customPresets.find((item) => item.id === selectedPresetId);
    if (!selected) return;
    const next = customPresets.filter((item) => item.id !== selectedPresetId);
    setCustomPresets(next);
    saveCustomFilterPresets(next);
    setSelectedPresetId("");
  };

  const reset = () => {
    const clean = {
      ...filters,
      macro: "",
      year: "",
      month: "",
      category: "",
      status: "",
      owner: "",
      sector: "",
      outputType: "",
      ageBand: "",
      q: "",
      threshold: "30",
      offset: 0,
    };
    setDraft(clean);
    setSelectedPresetId("");
    onApply(clean);
    setOpen(false);
  };
  const active = activeDashboardFilters(filters);
  const selectionCount = active.filter((item) => item.key !== "period").length;
  const period = `${filters.from || "Início"} — ${filters.to || "Data de corte"}`;
  const close = () => {
    setDraft(filters);
    setOpen(false);
  };

  return (
    <>
      <div className="filter-toolbar" aria-label="Resumo dos filtros">
        <div>
          <span>Período de análise</span>
          <strong>{period}</strong>
        </div>
        <button
          type="button"
          className="filter-launcher"
          aria-haspopup="dialog"
          aria-controls="global-filter-drawer"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span className="filter-launcher-icon" aria-hidden="true">≡</span>
          <span><strong>Filtros</strong><small>{selectionCount ? `${selectionCount} ativo${selectionCount > 1 ? "s" : ""}` : "Ajustar recorte"}</small></span>
          {selectionCount ? <b>{selectionCount}</b> : null}
        </button>
      </div>

      {open ? (
        <>
          <button type="button" className="filter-drawer-backdrop" aria-label="Fechar filtros" onClick={close} />
          <aside id="global-filter-drawer" className="filter-drawer" role="dialog" aria-modal="true" aria-labelledby="filter-drawer-title">
            <header className="filter-drawer-header">
              <div><span>RECORTE ANALÍTICO</span><h2 id="filter-drawer-title">Filtros do painel</h2><p>As alterações afetam todos os gráficos e a tabela.</p></div>
              <button type="button" className="drawer-close" aria-label="Fechar filtros" onClick={close}>×</button>
            </header>
            <form
              className="filter-bar"
              onSubmit={(event) => {
                event.preventDefault();
                onApply({ ...draft, offset: 0 });
                setOpen(false);
              }}
            >
              <div className="active-filter-strip" aria-live="polite">
                <strong>Filtros ativos</strong>
                {active.length ? active.map((item) => <span key={item.key}>{item.label}: {item.value}</span>) : <span>Nenhum</span>}
              </div>

              <section className="special-filter-panel" aria-label="Filtros especiais">
                <div className="special-filter-heading">
                  <div><span>Filtro especial</span><strong>Aplicar conjunto de categorias</strong></div>
                  {activePreset ? <b>{activePreset.name}</b> : null}
                </div>
                <div className="special-filter-row">
                  <select value={selectedPresetId} onChange={(event) => applyPreset(event.target.value)} aria-label="Escolher filtro especial">
                    <option value="">Escolher filtro…</option>
                    {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}{preset.builtin ? " · padrão" : ""}</option>)}
                  </select>
                  {customPresets.some((preset) => preset.id === selectedPresetId) ? (
                    <button type="button" className="special-filter-delete" onClick={deleteCustomPreset}>Excluir</button>
                  ) : null}
                </div>
                <div className="special-filter-create">
                  <input
                    type="text"
                    maxLength={48}
                    value={presetName}
                    placeholder="Nome do novo filtro"
                    aria-label="Nome do novo filtro especial"
                    onChange={(event) => setPresetName(event.target.value)}
                  />
                  <button type="button" onClick={saveCurrentAsPreset} disabled={!presetName.trim() || !categories.length}>Salvar seleção atual</button>
                </div>
                <small>Filtros criados aqui ficam salvos neste navegador. O filtro “Processos de Obra” já está disponível como padrão.</small>
              </section>

              <label className="filter-half"><span>De</span><input type="date" value={draft.from} onChange={(e) => update("from", e.target.value)} /></label>
              <label className="filter-half"><span>Até</span><input type="date" value={draft.to} onChange={(e) => update("to", e.target.value)} /></label>
              <label className="filter-half"><span>Ano</span><select value={draft.year} onChange={(e) => update("year", e.target.value)}><option value="">Todos</option>{options?.years.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="filter-half"><span>Mês</span><select value={draft.month} onChange={(e) => update("month", e.target.value)}><option value="">Todos</option>{options?.months.map((value) => <option key={value} value={value}>{String(value).padStart(2, "0")}</option>)}</select></label>
              <label><span>Macroprocesso</span><select value={draft.macro} onChange={(e) => update("macro", e.target.value)}><option value="">Todos</option>{options?.macroprocesses.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Status</span><select value={draft.status} onChange={(e) => update("status", e.target.value)}><option value="">Todos</option>{options?.statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Setor</span><select value={draft.sector} onChange={(e) => update("sector", e.target.value)}><option value="">Todos</option>{options?.sectors.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Responsabilidade</span><select value={draft.owner} onChange={(e) => update("owner", e.target.value)}><option value="">Todas</option>{options?.owners.map((value) => <option key={value}>{value}</option>)}</select></label>

              <fieldset className="category-multiselect">
                <legend>Categoria</legend>
                <div className="category-multiselect-summary">
                  <span>
                    {allCategoriesSelected
                      ? `Todas as ${availableCategories.length} categorias selecionadas`
                      : `${categories.length} categoria${categories.length > 1 ? "s" : ""} selecionada${categories.length > 1 ? "s" : ""}`}
                  </span>
                  {!allCategoriesSelected ? <button type="button" onClick={() => update("category", "")}>Selecionar todas</button> : null}
                </div>
                <div className="category-options" role="group" aria-label="Selecionar categorias">
                  {options?.categories.map((value) => {
                    const checked = categorySet.has(value);
                    return (
                      <label key={value} className={checked ? "category-option selected" : "category-option"}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCategory(value)} />
                        <span>{value}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="search-field"><span>Localizar protocolo</span><input type="search" placeholder="Ex.: 42289/2026" value={draft.q} onChange={(e) => update("q", e.target.value)} /></label>
              <div className="filter-actions">
                <button type="button" className="ghost-button" onClick={reset}>Limpar filtros</button>
                <button type="submit" className="primary-button" disabled={loading}>{loading ? "Atualizando…" : "Aplicar filtros"}</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </>
  );
}
