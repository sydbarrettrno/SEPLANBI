import type { DashboardData, DashboardFilters } from "./types";
import { analyticsSearchParams, type AnalyticsRequest, type AnalyticsResponse } from "./analytics";
import { extendedSearchParams, type ExtendedRequest, type ExtendedResponse } from "./extended";
import type { DashboardCopy } from "./content/dashboardCopy";

export interface DashboardCopyPayload {
  ok: boolean;
  copy: DashboardCopy;
  updated_at: string | null;
  persistent: boolean;
}

export interface AdminSessionPayload {
  ok: boolean;
  authorized: boolean;
  expires_in?: number;
}

export async function fetchDashboard(
  filters: DashboardFilters,
  signal?: AbortSignal,
): Promise<DashboardData> {
  const query = new URLSearchParams({ action: "dashboard" });
  const values: Record<string, string> = {
    from: filters.from,
    to: filters.to,
    year: filters.year,
    month: filters.month,
    macro: filters.macro,
    category: filters.category,
    status: filters.status,
    owner: filters.owner,
    sector: filters.sector,
    output_type: filters.outputType,
    q: filters.q,
    threshold: filters.threshold,
    recordset: filters.recordset,
    offset: String(filters.offset),
    limit: String(filters.limit),
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) query.set(key, value);
  }

  const response = await fetch(`/api?${query.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`A API respondeu com o código ${response.status}.`);
  }
  return (await response.json()) as DashboardData;
}

export async function fetchAnalytics(
  request: AnalyticsRequest,
  signal?: AbortSignal,
): Promise<AnalyticsResponse> {
  const response = await fetch(`/api?${analyticsSearchParams(request).toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  return readJson<AnalyticsResponse>(response);
}

export async function fetchExtendedIndicator(
  request: ExtendedRequest,
  signal?: AbortSignal,
): Promise<ExtendedResponse> {
  const response = await fetch(`/api?${extendedSearchParams(request).toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  return readJson<ExtendedResponse>(response);
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `A API respondeu com o código ${response.status}.`);
  }
  return payload;
}

export async function fetchDashboardCopy(signal?: AbortSignal): Promise<DashboardCopyPayload> {
  const response = await fetch("/api?action=dashboard-copy", {
    signal,
    headers: { Accept: "application/json" },
  });
  return readJson<DashboardCopyPayload>(response);
}

export async function fetchAdminSession(signal?: AbortSignal): Promise<AdminSessionPayload> {
  const response = await fetch("/api?action=admin-session", {
    signal,
    headers: { Accept: "application/json" },
  });
  return readJson<AdminSessionPayload>(response);
}

export async function authenticateAdmin(password: string): Promise<AdminSessionPayload> {
  const response = await fetch("/api?action=admin-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ password }),
  });
  return readJson<AdminSessionPayload>(response);
}

export async function logoutAdmin(): Promise<void> {
  const response = await fetch("/api?action=admin-logout", {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  await readJson<{ ok: boolean }>(response);
}

export async function saveDashboardCopy(copy: DashboardCopy): Promise<DashboardCopyPayload> {
  const response = await fetch("/api?action=dashboard-copy", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ copy }),
  });
  return readJson<DashboardCopyPayload>(response);
}

function filenameFromDisposition(disposition: string | null): string {
  if (!disposition) return "SEPLAN_BASE_COMPLETA.xlsx";
  const marker = 'filename="';
  const start = disposition.indexOf(marker);
  if (start < 0) return "SEPLAN_BASE_COMPLETA.xlsx";
  const rest = disposition.slice(start + marker.length);
  const end = rest.indexOf('"');
  return end >= 0 ? rest.slice(0, end) : "SEPLAN_BASE_COMPLETA.xlsx";
}

export async function exportPrivateWorkbook(password: string): Promise<string> {
  const response = await fetch("/api?action=private-export", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    let message = `A API respondeu com o código ${response.status}.`;
    try {
      const payload = await response.json() as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // resposta não JSON: mantém a mensagem padrão
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename = filenameFromDisposition(response.headers.get("Content-Disposition"));
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return filename;
}
