import { useDashboardContent } from "../content/DashboardContentContext";
import type { PageId } from "../types";

interface SidebarProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
  open: boolean;
  onClose: () => void;
  adminAuthorized?: boolean;
}

const NAV_ICONS: Record<string, string> = {
  overview: "⌁",
  received: "↗",
  outputs: "✓",
  stock: "▤",
  kpi04: "◷",
  kpi10: "◆",
  processes: "▤",
  indicators: "◫",
  admin: "⚙",
};

const NAV_ICON_STYLES: Record<string, { color: string; background: string; boxShadow: string }> = {
  overview: { color: "#77c4ff", background: "rgba(51, 151, 229, .16)", boxShadow: "inset 0 0 0 1px rgba(119, 196, 255, .08)" },
  received: { color: "#55b6ff", background: "rgba(45, 145, 225, .17)", boxShadow: "inset 0 0 0 1px rgba(85, 182, 255, .08)" },
  outputs: { color: "#62d7a5", background: "rgba(41, 165, 113, .17)", boxShadow: "inset 0 0 0 1px rgba(98, 215, 165, .08)" },
  stock: { color: "#ffb35f", background: "rgba(224, 125, 30, .17)", boxShadow: "inset 0 0 0 1px rgba(255, 179, 95, .08)" },
  kpi04: { color: "#b7a7ff", background: "rgba(118, 96, 201, .20)", boxShadow: "inset 0 0 0 1px rgba(183, 167, 255, .09)" },
  kpi10: { color: "#62c8ff", background: "rgba(37, 152, 205, .18)", boxShadow: "inset 0 0 0 1px rgba(98, 200, 255, .08)" },
  processes: { color: "#a7bad0", background: "rgba(126, 151, 178, .16)", boxShadow: "inset 0 0 0 1px rgba(167, 186, 208, .08)" },
  indicators: { color: "#7cc5ff", background: "rgba(52, 137, 207, .16)", boxShadow: "inset 0 0 0 1px rgba(124, 197, 255, .08)" },
  admin: { color: "#8be0bd", background: "rgba(43, 151, 111, .18)", boxShadow: "inset 0 0 0 1px rgba(139, 224, 189, .08)" },
};

const KPI_ROUTES: PageId[] = ["kpi05", "kpi06", "kpi07", "kpi08", "kpi09", "kpi11"];

interface NavSection {
  label: string;
  items: PageId[];
}

const BASE_SECTIONS: NavSection[] = [
  { label: "Visão geral", items: ["overview"] },
  { label: "Fluxo", items: ["received", "outputs", "stock"] },
  { label: "Análise", items: ["kpi04", "indicators", "processes"] },
  { label: "Gestão", items: ["kpi10"] },
];

export function Sidebar({ page, onNavigate, open, onClose, adminAuthorized = false }: SidebarProps) {
  const { copy } = useDashboardContent();
  const baseItems = copy.sidebar.items as Record<string, { label: string; caption: string }>;
  const items: Record<string, { label: string; caption: string }> = {
    ...baseItems,
    kpi04: { label: copy.kpi04.title, caption: "Tempo de tramitação" },
    kpi10: { label: copy.kpi10.title, caption: "Projetos por etapa" },
  };
  const sections = adminAuthorized
    ? [...BASE_SECTIONS, { label: "Sistema", items: ["admin"] as PageId[] }]
    : BASE_SECTIONS;

  const isActive = (id: PageId) => {
    if (id === "indicators" && KPI_ROUTES.includes(page)) return true;
    return page === id;
  };

  return (
    <>
      <button
        className={`sidebar-backdrop ${open ? "is-open" : ""}`}
        aria-label="Fechar menu"
        onClick={onClose}
      />
      <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="Navegação principal">
        <div className="sidebar-context">
          <span>{copy.sidebar.contextLabel}</span>
          <strong>{copy.sidebar.contextTitle}</strong>
        </div>

        <nav className="sidebar-nav-groups">
          {sections.map((section) => (
            <section className="sidebar-nav-section" key={section.label} aria-label={section.label}>
              <span className="sidebar-nav-heading">{section.label}</span>
              {section.items.map((id) => {
                const item = items[id];
                if (!item) return null;
                const active = isActive(id);
                return (
                  <button
                    key={id}
                    className={active ? "active" : ""}
                    onClick={() => {
                      onNavigate(id);
                      onClose();
                    }}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="nav-icon" style={NAV_ICON_STYLES[id]} aria-hidden="true">{NAV_ICONS[id]}</span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.caption}</small>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          <div>
            <strong>{copy.sidebar.footerTitle}</strong>
            <small>{copy.sidebar.footerCaption}</small>
          </div>
        </div>
      </aside>
    </>
  );
}
