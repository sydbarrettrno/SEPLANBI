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

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

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
  };
  const active = activeDashboardFilters(filters);

  return (
    <form
      className="filter-bar"
      onSubmit={(event) => {
        event.preventDefault();
        onApply({ ...draft, offset: 0 });
      }}
    >
      <div className="active-filter-strip" aria-live="polite">
        <strong>Filtros ativos</strong>
        {active.length ? active.map((item) => <span key={item.key}>{item.label}: {item.value}</span>) : <span>Nenhum</span>}
      </div>
      <label>
        <span>De</span>
        <input type="date" value={draft.from} onChange={(e) => update("from", e.target.value)} />
      </label>
      <label>
        <span>Até</span>
        <input type="date" value={draft.to} onChange={(e) => update("to", e.target.value)} />
      </label>
      <label>
        <span>Ano</span>
        <select value={draft.year} onChange={(e) => update("year", e.target.value)}>
          <option value="">Todos</option>
          {options?.years.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>Mês</span>
        <select value={draft.month} onChange={(e) => update("month", e.target.value)}>
          <option value="">Todos</option>
          {options?.months.map((value) => <option key={value} value={value}>{String(value).padStart(2, "0")}</option>)}
        </select>
      </label>
      <label>
        <span>Macroprocesso</span>
        <select value={draft.macro} onChange={(e) => update("macro", e.target.value)}>
          <option value="">Todos</option>
          {options?.macroprocesses.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>Status</span>
        <select value={draft.status} onChange={(e) => update("status", e.target.value)}>
          <option value="">Todos</option>
          {options?.statuses.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>Setor</span>
        <select value={draft.sector} onChange={(e) => update("sector", e.target.value)}>
          <option value="">Todos</option>
          {options?.sectors.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>Responsabilidade</span>
        <select value={draft.owner} onChange={(e) => update("owner", e.target.value)}>
          <option value="">Todas</option>
          {options?.owners.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>Categoria</span>
        <select value={draft.category} onChange={(e) => update("category", e.target.value)}>
          <option value="">Todas</option>
          {options?.categories.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label className="search-field">
        <span>Localizar protocolo</span>
        <input
          type="search"
          placeholder="Ex.: 42289/2026"
          value={draft.q}
          onChange={(e) => update("q", e.target.value)}
        />
      </label>
      <div className="filter-actions">
        <button type="button" className="ghost-button" onClick={reset}>Limpar filtros</button>
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Atualizando…" : "Aplicar filtros"}
        </button>
      </div>
    </form>
  );
}
