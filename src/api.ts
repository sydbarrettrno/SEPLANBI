import type { CardDescriptionMap, CardDescriptionsPayload, DashboardData, DashboardFilters } from "./types";

export async function fetchDashboard(
  filters: DashboardFilters,
  signal?: AbortSignal,
): Promise<DashboardData> {
  const query = new URLSearchParams({ action: "dashboard" });
  const values: Record<string, string> = {
    from: filters.from,
    to: filters.to,
    macro: filters.macro,
    category: filters.category,
    status: filters.status,
    owner: filters.owner,
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

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `A API respondeu com o código ${response.status}.`);
  }
  return payload;
}

export async function fetchCardDescriptions(signal?: AbortSignal): Promise<CardDescriptionsPayload> {
  const response = await fetch("/api?action=card-descriptions", {
    signal,
    headers: { Accept: "application/json" },
  });
  return readJson<CardDescriptionsPayload>(response);
}

export async function saveCardDescriptions(descriptions: CardDescriptionMap, password: string): Promise<CardDescriptionsPayload> {
  const response = await fetch("/api?action=card-descriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ descriptions, password }),
  });
  return readJson<CardDescriptionsPayload>(response);
}
