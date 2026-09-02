export type PageId = "overview" | "received" | "outputs" | "stock" | "processes" | "indicators" | "projects" | "kpi04" | "kpi05" | "kpi06" | "kpi07" | "kpi08" | "kpi09" | "kpi11" | "admin";
export type Recordset = "all" | "received" | "concluded" | "stock" | "stopped";
export type DetailId = "all" | "received" | "concluded" | "balance" | "stock" | "time" | "stopped" | "external" | "paralyzed";

export interface FlowPoint {
  month: string;
  received: number;
  concluded: number;
  concluded_formal: number;
  same_month_outputs: number;
  backlog_outputs: number;
}

export interface NamedValue {
  name: string;
  value: number;
}

export interface Turnaround {
  eligible: number;
  median_days: number | null;
  mean_days: number | null;
  p90_days: number | null;
}

export interface DashboardMetrics {
  received: number;
  concluded: number;
  concluded_formal: number;
  stock: number;
  internal_queue: number;
  external_wait: number;
  paralyzed: number;
  period_balance: number;
  completion_rate: number;
  formal_completion_rate: number;
  turnaround: Turnaround;
  turnaround_formal: Turnaround;
  stopped: {
    threshold_days: number;
    count: number;
    eligible_stock: number;
    percent: number;
    denominator_label: string;
  };
}

export interface ProcessRecord {
  protocol: string;
  protocol_id: string;
  opened: string;
  last_movement: string;
  closed: string | null;
  operational_close: string | null;
  category: string;
  macroprocess: string;
  status: string;
  owner: string;
  days_without_movement: number | null;
  sector: string;
}

export interface IndicatorCoverage {
  id: string;
  name: string;
  status: string;
  reason: string;
}

export interface DashboardData {
  meta: {
    dataset: string;
    source_rows: number;
    source_updated_at: string;
    schema_version: number;
    scope_rows: number;
    period: { from: string; to: string };
    taxonomy_version: string;
    category_count: number;
    privacy_note: string;
  };
  metrics: DashboardMetrics;
  management: {
    comparison: {
      current: {
        received: number;
        concluded_total: number;
        concluded_formal_total: number;
        cohort_concluded: number;
        cohort_concluded_formal: number;
        passive_absorbed: number;
        passive_absorbed_formal: number;
      };
      previous: {
        from: string;
        to: string;
        received: number;
        cohort_concluded: number;
        cohort_concluded_formal: number;
      };
      received_change_percent: number;
      cohort_concluded_change_percent: number;
      cohort_formal_change_percent: number;
      note: string;
    };
    flow_explanation: {
      rule: string;
      same_month_label: string;
      backlog_label: string;
    };
    position: {
      stock: number;
      internal_queue: number;
      external_wait: number;
      paralyzed: number;
      internal_percent: number;
      external_percent: number;
    };
    data_quality: { operational_closed_without_formal_date: number };
    complaints: { received: number; responded_operational: number; stock: number };
    inspections: { protocols_received: number; protocols_concluded_operational: number; protocols_stock: number; note: string };
    public_projects: { protocols_identified: number; protocols_received: number; protocols_concluded_operational: number; protocols_stock: number; reference_date: string | null; note: string };
  };
  charts: {
    flow: FlowPoint[];
    aging: NamedValue[];
    internal_aging: NamedValue[];
    categories: NamedValue[];
    internal_categories: NamedValue[];
    owners: NamedValue[];
    statuses: NamedValue[];
    received_categories: NamedValue[];
    concluded_categories: NamedValue[];
    public_projects_status: NamedValue[];
  };
  records: {
    total: number;
    offset: number;
    limit: number;
    recordset: Recordset;
    items: ProcessRecord[];
  };
  options: {
    years: string[];
    months: string[];
    categories: string[];
    statuses: string[];
    owners: string[];
    macroprocesses: string[];
    sectors: string[];
  };
  indicator_coverage: IndicatorCoverage[];
}

export interface DashboardFilters {
  from: string;
  to: string;
  year: string;
  month: string;
  macro: string;
  category: string;
  status: string;
  owner: string;
  sector: string;
  outputType: string;
  ageBand: string;
  q: string;
  threshold: string;
  recordset: Recordset;
  offset: number;
  limit: number;
}

export type CardDescriptionMap = Record<string, string>;

export interface CardDescriptionsPayload {
  ok: boolean;
  descriptions: CardDescriptionMap;
  updated_at: string | null;
  persistent: boolean;
}
