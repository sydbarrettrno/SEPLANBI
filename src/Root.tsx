import { useEffect, useMemo, useState } from "react";
import App from "./App";
import { fetchAdminSession } from "./api";
import { AdminAccessGate } from "./components/AdminAccessGate";
import { ConstructionPermitsPanel } from "./components/ConstructionPermitsPanel";
import { ExtendedIndicatorPanel } from "./components/ExtendedIndicatorPanel";
import { IndicatorAuditSupplement } from "./components/IndicatorAuditSupplement";
import { IndicatorMonthlyTrend } from "./components/IndicatorMonthlyTrend";
import { Sidebar } from "./components/Sidebar";
import { TimeComparisonPanel } from "./components/TimeComparisonPanel";
import { DashboardContentProvider, useDashboardContent } from "./content/DashboardContentContext";
import type { ExtendedKpi } from "./extended";
import type { DashboardFilters, PageId } from "./types";

const KPI_BY_ROUTE: Record<string, ExtendedKpi> = {
  kpi04: 4,
  kpi05: 5,
  kpi06: 6,
  kpi07: 7,
  kpi08: 8,
  kpi09: 9,
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

function RootRoutes() {
  const [route, setRoute] = useState(currentRoute);
  const [filters, setFilters] = useState<DashboardFilters>(INITIAL_FILTERS);
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { copy } = useDashboardContent();

  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminSession(controller.signal)
      .then((result) => setAdminAuthorized(result.authorized))
      .catch(() => setAdminAuthorized(false))
      .finally(() => { if (!controller.signal.aborted) setAdminChecked(true); });
    return () => controller.abort();
  }, []);

  const navigate = (page: PageId) => {
    setRoute(page);
    window.location.hash = `#/${page}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openAdmin = () => navigate("admin");
  const kpi = useMemo(() => route === "projects" ? 10 : KPI_BY_ROUTE[route], [route]);
  const isProjects = route === "projects";
  const isConstruction = route === "construction";
  const updateExtendedFilters = (next: DashboardFilters) => setFilters({ ...next, recordset: "all", offset: 0 });

  return (
    <>
      {isConstruction ? (
        <div className="app-shell extended-route-shell">
          <Sidebar
            page="construction"
            onNavigate={navigate}
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            adminAuthorized={adminAuthorized}
          />
          <div className="app-main">
            <main className="content">
              <nav className="extended-route-nav" aria-label="Navegação da seção construção civil">
                <button className="ghost-button extended-menu-launcher" type="button" onClick={() => setMenuOpen(true)}>
                  ☰ Menu
                </button>
                <a className="ghost-button" href="#/overview">← {copy.common.breadcrumbOverview}</a>
              </nav>
              <ConstructionPermitsPanel />
            </main>
          </div>
        </div>
      ) : kpi ? (
        <div className="app-shell extended-route-shell">
          <Sidebar
            page={route as PageId}
            onNavigate={navigate}
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            adminAuthorized={adminAuthorized}
          />
          <div className="app-main">
            <main className="content">
              <nav className="extended-route-nav" aria-label="Navegação do indicador">
                <button className="ghost-button extended-menu-launcher" type="button" onClick={() => setMenuOpen(true)}>
                  ☰ Menu
                </button>
                <a className="ghost-button" href={isProjects ? "#/overview" : "#/indicators"}>← {isProjects ? copy.common.breadcrumbOverview : copy.common.breadcrumbIndicators}</a>
                <a className="ghost-button" href="#/overview">{copy.common.breadcrumbOverview}</a>
              </nav>
              <ExtendedIndicatorPanel
                kpi={kpi}
                filters={filters}
                onFilters={updateExtendedFilters}
              />
              {kpi === 4 ? (
                <TimeComparisonPanel
                  filters={filters}
                  onMonth={(month) => updateExtendedFilters({ ...filters, month: filters.month === month ? "" : month })}
                />
              ) : null}
              {kpi === 7 || kpi === 9 ? <IndicatorMonthlyTrend kpi={kpi} filters={filters} /> : null}
              {kpi === 6 || kpi === 8 || kpi === 11 ? (
                <IndicatorAuditSupplement
                  kpi={kpi}
                  filters={filters}
                  onOwner={(owner) => updateExtendedFilters({ ...filters, owner: filters.owner === owner ? "" : owner })}
                />
              ) : null}
            </main>
          </div>
        </div>
      ) : <App adminAuthorized={adminAuthorized} />}

      <AdminAccessGate
        authorized={adminAuthorized}
        checking={!adminChecked}
        autoOpen={route === "admin" && adminChecked && !adminAuthorized}
        onAuthenticated={() => setAdminAuthorized(true)}
        onOpenAdmin={openAdmin}
      />
    </>
  );
}

export default function Root() {
  return (
    <DashboardContentProvider>
      <RootRoutes />
    </DashboardContentProvider>
  );
}
