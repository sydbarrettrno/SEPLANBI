import { formatDate } from "../format";

interface HeaderProps {
  sourceDate?: string;
  scopeRows?: number;
  onMenu: () => void;
}

export function Header({ sourceDate, scopeRows, onMenu }: HeaderProps) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenu} aria-label="Abrir menu">☰</button>
      <div className="topbar-title">
        <span>SEPLAN · ITAPOÁ/SC</span>
        <strong>Painel de Resultados</strong>
      </div>
      <div className="topbar-meta">
        <div>
          <small>RECORTE ATUAL</small>
          <strong>{scopeRows?.toLocaleString("pt-BR") ?? "—"} protocolos</strong>
        </div>
        <div>
          <small>BASE ATUALIZADA</small>
          <strong>{formatDate(sourceDate)}</strong>
        </div>
        <span className="live-pill"><i /> Dados validados</span>
      </div>
    </header>
  );
}
