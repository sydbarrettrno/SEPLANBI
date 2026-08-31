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
  kpi06: "⌛",
  kpi07: "↻",
  kpi08: "◎",
  kpi09: "!",
  kpi10: "◆",
  kpi11: "▦",
  processes: "▤",
  indicators: "◫",
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
              <span className="nav-icon" aria-hidden="true">{NAV_ICONS[id]}</span>
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
