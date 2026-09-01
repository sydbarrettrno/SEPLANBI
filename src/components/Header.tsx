import { formatDate } from "../format";
import logoMunicipio from "../../assets/logo-municipio-itapoa.png";
import { PrivateExportButton } from "./PrivateExportButton";

interface HeaderProps {
  sourceDate?: string;
  scopeRows?: number;
  onMenu: () => void;
}

export function Header({ sourceDate, scopeRows, onMenu }: HeaderProps) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenu} aria-label="Abrir menu">☰</button>
      <div className="topbar-brand">
        <img src={logoMunicipio} alt="Município de Itapoá" />
        <i aria-hidden="true" />
        <div>
          <strong>SEPLAN</strong>
          <span>Secretaria de Planejamento Urbano</span>
        </div>
      </div>
      <div className="topbar-meta">
        <div>
          <small>BASE ATUALIZADA</small>
          <strong>{formatDate(sourceDate)} · {scopeRows?.toLocaleString("pt-BR") ?? "—"} protocolos</strong>
        </div>
        <PrivateExportButton sourceDate={sourceDate} />
        <span className="live-pill"><i /> Dados validados</span>
      </div>
    </header>
  );
}
