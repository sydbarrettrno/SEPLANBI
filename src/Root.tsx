import { useEffect, useMemo, useState } from "react";
import App from "./App";
import { ExtendedIndicatorPanel } from "./components/ExtendedIndicatorPanel";
import type { ExtendedKpi } from "./extended";
import type { DashboardFilters } from "./types";

const KPI_BY_ROUTE: Record<string, ExtendedKpi> = {
  kpi04: 4,
  kpi05: 5,
  kpi06: 6,
  kpi07: 7,
  kpi08: 8,
  kpi09: 9,
  kpi10: 10,
  kpi11: 11,
};

const INITIAL_FILTERS: DashboardFilters = {
  from: "",
  to: "",
  year: "",
  month: "",
  macro: "",
  category: "",
  status: "",
  owner: "",
  sector: "",
  outputType: "",
  ageBand: "",
  q: "",
  threshold: "30",
  recordset: "all",
  offset: 0,
  limit: 50,
};

function currentRoute() {
  return window.location.hash.replace(/^#\/?/, "");
}

export default function Root() {
  const [route, setRoute] = useState(currentRoute);
  const [filters, setFilters] = useState<DashboardFilters>(INITIAL_FILTERS);

  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const kpi = useMemo(() => KPI_BY_ROUTE[route], [route]);
  if (!kpi) return <App />;

  return (
    <div className="app-shell extended-route-shell">
      <div className="app-main">
        <main className="content">
          <nav className="extended-route-nav" aria-label="Navegação do indicador">
            <a className="ghost-button" href="#/indicators">← Carteira de indicadores</a>
            <a className="ghost-button" href="#/overview">Visão executiva</a>
          </nav>
          <ExtendedIndicatorPanel
            kpi={kpi}
            filters={filters}
            onFilters={(next) => setFilters({ ...next, recordset: "all", offset: 0 })}
          />
        </main>
      </div>
    </div>
  );
}
