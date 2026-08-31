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
  processes: "▤",
  indicators: "◫",
  admin: "⚙",
};

const NAV_ORDER: PageId[] = ["overview", "received", "outputs", "stock", "processes", "indicators", "admin"];

export function Sidebar({ page, onNavigate, open, onClose }: SidebarProps) {
  const { copy } = useDashboardContent();
  const items = copy.sidebar.items as Record<string, { label: string; caption: string }>;

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

        <nav>
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
