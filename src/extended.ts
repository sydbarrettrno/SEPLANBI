export type ExtendedKpi = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface ExtendedNamedValue {
  name: string;
  value: number;
}

export interface ExtendedRecord {
  protocol?: string;
  protocol_id?: string;
  opened?: string;
  last_movement?: string;
  macroprocess?: string;
  category?: string;
  status?: string;
  days_without_movement?: number | null;
  sector?: string;
  duration_days?: number;
  diligence_count?: number;
  last_diligence?: string;
  ID?: string;
  FaseAtual?: string;
  StatusAtual?: string;
  DataReferencia?: string;
  Projeto?: string;
  Grupo?: string;
  Interface?: string;
  Confianca?: string;
  current_activity?: string;
  blocker?: string;
  evidence?: string;
  source_detail?: string;
  audit_note?: string;
}

export interface ExtendedComparisonMonthlyPoint {
  month: number;
  current: number | null;
  previous: number | null;
  current_eligible: number;
  previous_eligible: number;
}

export interface ExtendedComparison {
  current?: Record<string, unknown>;
  previous?: Record<string, unknown>;
  median_change_days?: number | null;
  median_change_percent?: number | null;
  monthly?: ExtendedComparisonMonthlyPoint[];
  rule?: string;
}

export interface ExtendedResponse {
  ok: boolean;
  contract: string;
  meta: {
    source_rows: number;
    source_updated_at: string;
    taxonomy_version: string;
    privacy: string;
  };
  status: string;
  kpi: ExtendedKpi;
  name: string;
  rule?: string;
  reason?: string;
  threshold_days?: number;
  metrics?: Record<string, unknown> | null;
  context?: Record<string, unknown>;
  coverage?: Record<string, unknown>;
  comparison?: ExtendedComparison | null;
  monthly?: Array<Record<string, unknown>>;
  categories?: ExtendedNamedValue[];
  sectors?: ExtendedNamedValue[];
  statuses?: ExtendedNamedValue[];
  phases?: ExtendedNamedValue[];
  interfaces?: ExtendedNamedValue[];
  groups?: ExtendedNamedValue[];
  confidences?: ExtendedNamedValue[];
  bands?: ExtendedNamedValue[];
  distribution?: ExtendedNamedValue[];
  responsibilities?: ExtendedNamedValue[];
  sla_rules?: Array<Record<string, unknown>>;
  matrix?: {
    row_dimension: string;
    column_dimension: string;
    rows: string[];
    columns: string[];
    cells: Array<{ row: string; column: string; value: number }>;
  };
  records?: {
    total: number;
    offset: number;
    limit: number;
    items: ExtendedRecord[];
  };
}

export interface ExtendedRequest {
  kpi: ExtendedKpi;
  from?: string;
  to?: string;
  year?: string;
  month?: string;
  macro?: string;
  category?: string;
  status?: string;
  sector?: string;
  responsibility?: string;
  threshold?: string;
  inactivityBand?: string;
  projectPhase?: string;
  projectStatus?: string;
  projectInterface?: string;
  projectGroup?: string;
  projectConfidence?: string;
  rowDimension?: string;
  columnDimension?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export function extendedSearchParams(request: ExtendedRequest) {
  const params = new URLSearchParams({ action: "indicator-bi", kpi: String(request.kpi) });
  const values: Record<string, string | number | undefined> = {
    from: request.from,
    to: request.to,
    year: request.year,
    month: request.month,
    macro: request.macro,
    category: request.category,
    status: request.status,
    sector: request.sector,
    responsibility: request.responsibility,
    threshold: request.threshold,
    inactivity_band: request.inactivityBand,
    project_phase: request.projectPhase,
    project_status: request.projectStatus,
    project_interface: request.projectInterface,
    project_group: request.projectGroup,
    project_confidence: request.projectConfidence,
    row_dimension: request.rowDimension,
    column_dimension: request.columnDimension,
    q: request.q,
    limit: request.limit,
    offset: request.offset,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params;
}
