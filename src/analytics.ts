import type { DashboardFilters, DetailId } from "./types";
import { findPresetByCategoryValue } from "./filterPresets";

export type AnalyticsIndicator = "received" | "outputs" | "stock";

export interface AnalyticsRequest {
  indicator: AnalyticsIndicator;
  from?: string;
  to?: string;
  year?: string[];
  month?: number[];
  macro?: string[];
  category?: string[];
  status?: string[];
  sector?: string[];
  responsibility?: string[];
  outputType?: Array<"Concluído" | "Encerrado">;
  ageBand?: string[];
  groupBy?: string[];
  search?: string;
  includeRecords?: boolean;
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface ActiveFilterChip {
  key: string;
  label: string;
  value: string;
}

export interface AnalyticsResponse {
  ok: boolean;
  contract: "seplanbi-analytics-v1";
  meta: {
    indicator: AnalyticsIndicator;
    total: number;
    grouped_sum: number;
    grouping_reconciled: boolean;
  };
  filters: {
    active: Array<{ dimension: string; label: string; value: string }>;
    clear_action: { label: "Limpar filtros"; query: Record<string, never> };
  };
  breadcrumb: Array<{ label: string; value: string }>;
  hierarchy: Array<{ dimension: string; label: string }>;
  groups: Array<{ keys: Record<string, string>; value: number }>;
  totals: {
    received: number;
    outputs: number;
    concluded: number;
    closed: number;
    period_balance: number;
    stock: number;
    internal: number;
    external: number;
    paralyzed: number;
    depends_on_seplan_percent: number | null;
  };
  comparison?: {
    current: { from: string; to: string; value: number };
    previous: { from: string; to: string; value: number };
    absolute_change: number;
    change_percent: number | null;
    monthly: Array<{ month: number; current: number; previous: number }>;
    rule: string;
  };
  monthly_flow?: Array<{ month: string; received: number; outputs: number; balance: number }>;
  options: {
    years: number[];
    months: number[];
    macroprocesses: string[];
    categories: string[];
    statuses: string[];
    sectors: string[];
    responsibilities: string[];
    output_types: string[];
    age_bands: string[];
  };
  permissions: {
    public_detail: boolean;
    private_detail: boolean;
    public_export: boolean;
    private_export: boolean;
    note: string;
  };
  records?: {
    total: number;
    offset: number;
    limit: number;
    items: Array<Record<string, string | number | null>>;
  };
}

function appendMany(query: URLSearchParams, key: string, values?: Array<string | number>) {
  if (values?.length) query.set(key, values.join("|"));
}

export function analyticsSearchParams(request: AnalyticsRequest): URLSearchParams {
  const query = new URLSearchParams({ action: "analytics", indicator: request.indicator });
  if (request.from) query.set("from", request.from);
  if (request.to) query.set("to", request.to);
  appendMany(query, "year", request.year);
  appendMany(query, "month", request.month);
  appendMany(query, "macro", request.macro);
  appendMany(query, "category", request.category);
  appendMany(query, "status", request.status);
  appendMany(query, "sector", request.sector);
  appendMany(query, "responsibility", request.responsibility);
  appendMany(query, "output_type", request.outputType);
  appendMany(query, "age_band", request.ageBand);
  if (request.groupBy?.length) query.set("group_by", request.groupBy.join(","));
  if (request.search) query.set("q", request.search);
  if (request.includeRecords) query.set("include_records", "1");
  if (request.offset) query.set("offset", String(request.offset));
  if (request.limit) query.set("limit", String(request.limit));
  if (request.sortBy) query.set("sort_by", request.sortBy);
  if (request.sortDir) query.set("sort_dir", request.sortDir);
  return query;
}

export function publicAnalyticsExportUrl(request: AnalyticsRequest): string {
  const query = analyticsSearchParams(request);
  query.set("action", "analytics-export");
  query.delete("include_records");
  query.delete("offset");
  query.delete("limit");
  return `/api?${query.toString()}`;
}

export function activeDashboardFilters(filters: DashboardFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (filters.from || filters.to) {
    chips.push({ key: "period", label: "Período", value: `${filters.from || "início"} a ${filters.to || "corte"}` });
  }
  for (const [key, label, value] of [
    ["macro", "Família de Processos", filters.macro],
    ["year", "Ano", filters.year],
    ["month", "Mês", filters.month],
    ["category", "Categoria", filters.category],
    ["status", "Status", filters.status],
    ["owner", "Responsabilidade", filters.owner],
    ["sector", "Setor Responsável", filters.sector],
    ["outputType", "Tipo de saída", filters.outputType],
    ["ageBand", "Idade", filters.ageBand],
    ["q", "Pesquisa", filters.q],
  ] as const) {
    if (value) {
      if (key === "category") {
        const preset = findPresetByCategoryValue(value);
        if (preset) {
          chips.push({ key: "specialFilter", label: "Filtro especial", value: preset.name });
          continue;
        }
      }
      const displayValue = key === "category" ? value.split("|").filter(Boolean).join(", ") : value;
      chips.push({ key, label, value: displayValue });
    }
  }
  return chips;
}

export function drillBreadcrumb(detail: DetailId, filters: DashboardFilters): string[] {
  const indicator = {
    received: "Recebidos",
    concluded: "Saídas",
    balance: "Saldo",
    stock: "Estoque",
    time: "Tempo",
    stopped: "Parados",
    external: "Responsável externo",
    paralyzed: "Paralisados",
    all: "Protocolos",
  }[detail];
  return ["Visão executiva", indicator, ...activeDashboardFilters(filters).map((item) => `${item.label}: ${item.value}`)];
}
