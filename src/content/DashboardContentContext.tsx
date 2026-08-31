import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchDashboardCopy, saveDashboardCopy } from "../api";
import { cloneDashboardCopy, DEFAULT_DASHBOARD_COPY, type DashboardCopy } from "./dashboardCopy";

interface DashboardContentState {
  copy: DashboardCopy;
  defaults: DashboardCopy;
  persistent: boolean;
  updatedAt: string | null;
  loading: boolean;
  save: (next: DashboardCopy, password: string) => Promise<void>;
}

const DashboardContentContext = createContext<DashboardContentState | null>(null);

export function DashboardContentProvider({ children }: { children: ReactNode }) {
  const [copy, setCopy] = useState<DashboardCopy>(() => cloneDashboardCopy(DEFAULT_DASHBOARD_COPY));
  const [persistent, setPersistent] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardCopy(controller.signal)
      .then((result) => {
        setCopy(result.copy);
        setPersistent(result.persistent);
        setUpdatedAt(result.updated_at);
      })
      .catch(() => {
        setCopy(cloneDashboardCopy(DEFAULT_DASHBOARD_COPY));
        setPersistent(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const value = useMemo<DashboardContentState>(() => ({
    copy,
    defaults: DEFAULT_DASHBOARD_COPY,
    persistent,
    updatedAt,
    loading,
    save: async (next, password) => {
      const result = await saveDashboardCopy(next, password);
      setCopy(result.copy);
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
