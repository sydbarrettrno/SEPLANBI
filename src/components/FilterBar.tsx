import { useEffect, useState } from "react";
import type { DashboardFilters, DashboardData } from "../types";
import { activeDashboardFilters } from "../analytics";

interface FilterBarProps {
  filters: DashboardFilters;
  options?: DashboardData["options"];
  onApply: (filters: DashboardFilters) => void;
  loading: boolean;
}

export function FilterBar({ filters, options, onApply, loading }: FilterBarProps) {
  const [draft, setDraft] = useState(filters);
  const [open, setOpen] = useState(false);

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
              <label className="filter-half"><span>De</span><input type="date" value={draft.from} onChange={(e) => update("from", e.target.value)} /></label>
              <label className="filter-half"><span>Até</span><input type="date" value={draft.to} onChange={(e) => update("to", e.target.value)} /></label>
              <label className="filter-half"><span>Ano</span><select value={draft.year} onChange={(e) => update("year", e.target.value)}><option value="">Todos</option>{options?.years.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="filter-half"><span>Mês</span><select value={draft.month} onChange={(e) => update("month", e.target.value)}><option value="">Todos</option>{options?.months.map((value) => <option key={value} value={value}>{String(value).padStart(2, "0")}</option>)}</select></label>
              <label><span>Macroprocesso</span><select value={draft.macro} onChange={(e) => update("macro", e.target.value)}><option value="">Todos</option>{options?.macroprocesses.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Status</span><select value={draft.status} onChange={(e) => update("status", e.target.value)}><option value="">Todos</option>{options?.statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Setor</span><select value={draft.sector} onChange={(e) => update("sector", e.target.value)}><option value="">Todos</option>{options?.sectors.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Responsabilidade</span><select value={draft.owner} onChange={(e) => update("owner", e.target.value)}><option value="">Todas</option>{options?.owners.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Categoria</span><select value={draft.category} onChange={(e) => update("category", e.target.value)}><option value="">Todas</option>{options?.categories.map((value) => <option key={value}>{value}</option>)}</select></label>
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
