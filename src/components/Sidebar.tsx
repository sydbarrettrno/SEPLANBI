import { useDashboardContent } from "../content/DashboardContentContext";
import type { PageId } from "../types";

interface SidebarProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
  open: boolean;
  onClose: () => void;
}

const NAV_ICONS: Record<string, string> = {
  overview: "⌁",
  received: "↗",
  outputs: "✓",
  stock: "▤",
  kpi04: "◷",
  kpi05: "Ⅱ",
  kpi06: "◇",
  kpi07: "↻",
  kpi08: "◎",
  kpi09: "!",
  kpi10: "◆",
  kpi11: "▦",
  processes: "▤",
  indicators: "◫",
};

const NAV_ICON_STYLES: Record<string, { color: string; background: string; boxShadow: string }> = {
  overview: { color: "#77c4ff", background: "rgba(51, 151, 229, .16)", boxShadow: "inset 0 0 0 1px rgba(119, 196, 255, .08)" },
  received: { color: "#55b6ff", background: "rgba(45, 145, 225, .17)", boxShadow: "inset 0 0 0 1px rgba(85, 182, 255, .08)" },
  outputs: { color: "#62d7a5", background: "rgba(41, 165, 113, .17)", boxShadow: "inset 0 0 0 1px rgba(98, 215, 165, .08)" },
  stock: { color: "#ffb35f", background: "rgba(224, 125, 30, .17)", boxShadow: "inset 0 0 0 1px rgba(255, 179, 95, .08)" },
  kpi04: { color: "#b7a7ff", background: "rgba(118, 96, 201, .20)", boxShadow: "inset 0 0 0 1px rgba(183, 167, 255, .09)" },
  kpi05: { color: "#ff9d70", background: "rgba(214, 105, 54, .18)", boxShadow: "inset 0 0 0 1px rgba(255, 157, 112, .08)" },
  kpi06: { color: "#ffd36b", background: "rgba(210, 157, 38, .18)", boxShadow: "inset 0 0 0 1px rgba(255, 211, 107, .08)" },
  kpi07: { color: "#66d5d1", background: "rgba(25, 154, 150, .18)", boxShadow: "inset 0 0 0 1px rgba(102, 213, 209, .08)" },
  kpi08: { color: "#ff7f88", background: "rgba(198, 63, 71, .18)", boxShadow: "inset 0 0 0 1px rgba(255, 127, 136, .08)" },
  kpi09: { color: "#e49bff", background: "rgba(154, 84, 186, .18)", boxShadow: "inset 0 0 0 1px rgba(228, 155, 255, .08)" },
  kpi10: { color: "#62c8ff", background: "rgba(37, 152, 205, .18)", boxShadow: "inset 0 0 0 1px rgba(98, 200, 255, .08)" },
  kpi11: { color: "#8be0bd", background: "rgba(43, 151, 111, .18)", boxShadow: "inset 0 0 0 1px rgba(139, 224, 189, .08)" },
  processes: { color: "#a7bad0", background: "rgba(126, 151, 178, .16)", boxShadow: "inset 0 0 0 1px rgba(167, 186, 208, .08)" },
  indicators: { color: "#7cc5ff", background: "rgba(52, 137, 207, .16)", boxShadow: "inset 0 0 0 1px rgba(124, 197, 255, .08)" },
};

const NAV_ORDER: PageId[] = [
  "overview",
  "received",
  "outputs",
  "stock",
  "kpi04",
  "kpi05",
  "kpi06",
  "kpi07",
  "kpi08",
  "kpi09",
  "kpi10",
  "kpi11",
  "processes",
  "indicators",
];

export function Sidebar({ page, onNavigate, open, onClose }: SidebarProps) {
  const { copy } = useDashboardContent();
  const baseItems = copy.sidebar.items as Record<string, { label: string; caption: string }>;
  const items: Record<string, { label: string; caption: string }> = {
    ...baseItems,
    kpi04: { label: copy.kpi04.title, caption: "Mediana, média e P90" },
    kpi05: { label: copy.kpi05.title, caption: "Fila interna sem movimento" },
    kpi06: { label: copy.kpi06.title, caption: "Regras SLA homologadas" },
    kpi07: { label: copy.kpi07.title, caption: "Retornos e reincidência" },
    kpi08: { label: copy.kpi08.title, caption: "Fiscalização auditada" },
    kpi09: { label: copy.kpi09.title, caption: "Recebidas e respondidas" },
    kpi10: { label: copy.kpi10.title, caption: "Carteira pública por etapa" },
    kpi11: { label: copy.kpi11.title, caption: "Responsabilidade e setor" },
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

        <nav style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", alignContent: "start" }}>
          {NAV_ORDER.map((id) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => {
                onNavigate(id);
                onClose();
              }}
              aria-current={page === id ? "page" : undefined}
            >
              <span className="nav-icon" style={NAV_ICON_STYLES[id]} aria-hidden="true">{NAV_ICONS[id]}</span>
              <span>
                <strong>{items[id].label}</strong>
                <small>{items[id].caption}</small>
              </span>
            </button>
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
