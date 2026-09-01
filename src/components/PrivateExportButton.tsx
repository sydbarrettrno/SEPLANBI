import { useState } from "react";
import "../private-export.css";

interface PrivateExportButtonProps {
  sourceDate?: string;
  label?: string;
  className?: string;
}

export function PrivateExportButton({
  sourceDate,
  label = "Exportar base completa",
  className = "private-export-trigger",
}: PrivateExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    if (exporting) return;
    setOpen(false);
    setPassword("");
    setError("");
  };

  const exportPrivateBase = async () => {
    if (!password.trim() || exporting) return;
    setExporting(true);
    setError("");
    try {
      const response = await fetch("/api?action=private-export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json",
        },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        let message = `Falha ao exportar a base (${response.status}).`;
        try {
          const payload = await response.json() as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          // Mantém a mensagem genérica quando a resposta não for JSON.
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
      setOpen(false);
    } catch (reason) {
      setPassword("");
      setError(reason instanceof Error ? reason.message : "Falha ao exportar a base completa.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        title="Exportar XLSX completo com nomes, responsáveis e observações"
      >
        <span aria-hidden="true">⇩</span>
        {label}
      </button>

      {open ? (
        <div
          className="private-export-backdrop"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
        >
          <section className="private-export-modal" role="dialog" aria-modal="true" aria-labelledby="private-export-title">
            <button type="button" className="private-export-close" onClick={close} aria-label="Fechar">×</button>
            <span className="private-export-icon" aria-hidden="true">⇩</span>
            <small>ACESSO RESTRITO</small>
            <h2 id="private-export-title">Exportar base completa</h2>
            <p>O XLSX contém a base atual com nomes, responsáveis, observações de abertura e do último trâmite, além dos campos operacionais. A senha é validada somente no servidor.</p>
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
            {error ? <div className="private-export-error">{error}</div> : null}
            <div className="private-export-actions">
              <button type="button" className="ghost-button" onClick={close} disabled={exporting}>Cancelar</button>
              <button type="button" className="primary-button" onClick={() => void exportPrivateBase()} disabled={exporting || !password.trim()}>
                {exporting ? "Gerando arquivo…" : "Exportar XLSX completo"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
