import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchDashboardCopy, saveDashboardCopy } from "../api";
import { cloneDashboardCopy, DEFAULT_DASHBOARD_COPY, type DashboardCopy } from "./dashboardCopy";

interface DashboardContentState {
  copy: DashboardCopy;
  defaults: DashboardCopy;
  persistent: boolean;
  updatedAt: string | null;
  loading: boolean;
  save: (next: DashboardCopy) => Promise<void>;
}

const DashboardContentContext = createContext<DashboardContentState | null>(null);

function applyPortfolioTerminology(source: DashboardCopy): DashboardCopy {
  const cloned = cloneDashboardCopy(source);
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value
        .replace(/ESTOQUE/g, "CARTEIRA DE ATENDIMENTO")
        .replace(/Estoque/g, "Carteira de Atendimento")
        .replace(/estoque/g, "carteira de atendimento");
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, walk(item)]));
    }
    return value;
  };
  return walk(cloned) as DashboardCopy;
}

const DEFAULTS_WITH_TERMINOLOGY = applyPortfolioTerminology(DEFAULT_DASHBOARD_COPY);

export function DashboardContentProvider({ children }: { children: ReactNode }) {
  const [copy, setCopy] = useState<DashboardCopy>(() => cloneDashboardCopy(DEFAULTS_WITH_TERMINOLOGY));
  const [persistent, setPersistent] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardCopy(controller.signal)
      .then((result) => {
        setCopy(applyPortfolioTerminology(result.copy));
        setPersistent(result.persistent);
        setUpdatedAt(result.updated_at);
      })
      .catch(() => {
        setCopy(cloneDashboardCopy(DEFAULTS_WITH_TERMINOLOGY));
        setPersistent(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const value = useMemo<DashboardContentState>(() => ({
    copy,
    defaults: DEFAULTS_WITH_TERMINOLOGY,
    persistent,
    updatedAt,
    loading,
    save: async (next) => {
      const normalized = applyPortfolioTerminology(next);
      const result = await saveDashboardCopy(normalized);
      setCopy(applyPortfolioTerminology(result.copy));
      setPersistent(result.persistent);
      setUpdatedAt(result.updated_at);
    },
  }), [copy, loading, persistent, updatedAt]);

  return <DashboardContentContext.Provider value={value}>{children}</DashboardContentContext.Provider>;
}

export function useDashboardContent() {
  const value = useContext(DashboardContentContext);
  if (!value) throw new Error("DashboardContentProvider não inicializado.");
  return value;
}
