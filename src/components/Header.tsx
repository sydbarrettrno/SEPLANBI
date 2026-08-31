import { useState } from "react";
import { formatDate } from "../format";
import logoMunicipio from "../../assets/logo-municipio-itapoa.png";
import "../private-export.css";

interface HeaderProps {
  sourceDate?: string;
  scopeRows?: number;
  onMenu: () => void;
}

export function Header({ sourceDate, scopeRows, onMenu }: HeaderProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const closeExport = () => {
    if (exporting) return;
    setExportOpen(false);
    setPassword("");
    setExportError("");
  };

  const exportPrivateBase = async () => {
    if (!password.trim() || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api?action=private-export", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        let message = `Falha ao exportar a base (${response.status}).`;
        try {
          const payload = await response.json() as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          // Mantém mensagem genérica quando a resposta não for JSON.
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `SEPLAN_BASE_COMPLETA_${sourceDate || "atual"}.xlsx`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setPassword("");
      setExportOpen(false);
    } catch (error) {
      setPassword("");
      setExportError(error instanceof Error ? error.message : "Falha ao exportar a base completa.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <button className="menu-button" onClick={onMenu} aria-label="Abrir menu">☰</button>
        <div className="topbar-brand">
          <img src={logoMunicipio} alt="Município de Itapoá" />
          <i aria-hidden="true" />
          <div>
            <strong>SEPLAN</strong>
            <span>Gestão por exceção</span>
          </div>
        </div>
        <div className="topbar-meta">
          <div>
            <small>BASE ATUALIZADA</small>
            <strong>{formatDate(sourceDate)} · {scopeRows?.toLocaleString("pt-BR") ?? "—"} protocolos</strong>
          </div>
          <button type="button" className="private-export-trigger" onClick={() => setExportOpen(true)} title="Exportar a base completa com campos privados">
            <span aria-hidden="true">⇩</span>
            Exportar base completa
          </button>
          <span className="live-pill"><i /> Dados validados</span>
        </div>
      </header>

      {exportOpen ? (
        <div className="private-export-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeExport(); }}>
          <section className="private-export-modal" role="dialog" aria-modal="true" aria-labelledby="private-export-title">
            <button type="button" className="private-export-close" onClick={closeExport} aria-label="Fechar">×</button>
            <span className="private-export-icon" aria-hidden="true">⇩</span>
            <small>ACESSO RESTRITO</small>
            <h2 id="private-export-title">Exportar base completa</h2>
            <p>O arquivo contém nomes, responsáveis e observações dos protocolos. A senha é validada somente no servidor e não é gravada no navegador.</p>
            <label>
              <span>Senha administrativa</span>
              <input
                type="password"
                value={password}
                autoFocus
                autoComplete="current-password"
                placeholder="Informe a senha"
                disabled={exporting}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void exportPrivateBase(); }}
              />
            </label>
            {exportError ? <div className="private-export-error">{exportError}</div> : null}
            <div className="private-export-actions">
              <button type="button" className="ghost-button" onClick={closeExport} disabled={exporting}>Cancelar</button>
              <button type="button" className="primary-button" onClick={() => void exportPrivateBase()} disabled={exporting || !password.trim()}>
                {exporting ? "Gerando arquivo…" : "Exportar XLSX"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
