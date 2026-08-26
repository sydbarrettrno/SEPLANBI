import type { PageId } from "../types";
import logoMunicipio from "../../assets/logo-municipio-itapoa.png";

interface SidebarProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: string; caption: string }> = [
  { id: "overview", label: "Visão executiva", icon: "⌁", caption: "Gestão por exceção" },
  { id: "processes", label: "Protocolos", icon: "▤", caption: "Filtros e drill-down" },
  { id: "indicators", label: "Indicadores", icon: "◫", caption: "Cobertura dos 11 KPI" },
  { id: "admin", label: "Administração", icon: "⚙", caption: "Textos dos cards" },
];

export function Sidebar({ page, onNavigate, open, onClose }: SidebarProps) {
  return (
    <>
      <button
        className={`sidebar-backdrop ${open ? "is-open" : ""}`}
        aria-label="Fechar menu"
        onClick={onClose}
      />
      <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="Navegação principal">
        <div className="brand-block">
          <img src={logoMunicipio} alt="Brasão do Município de Itapoá" />
        </div>

        <div className="sidebar-context">
          <span>Painel Executivo</span>
          <strong>Gestão à Vista</strong>
        </div>

        <nav>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
              aria-current={page === item.id ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.caption}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          <div>
            <strong>Base validada</strong>
            <small>Taxonomia V07</small>
          </div>
        </div>
      </aside>
    </>
  );
}
