import { useState } from "react";
import "../private-export.css";

interface PrivateExportButtonProps {
  sourceDate?: string;
  label?: string;
  className?: string;
}

interface PrivateBaseInstallResult {
  ok: boolean;
  source_kind: string;
  public_rows: number;
  private_rows: number;
  matched_rows: number;
  missing_private_rows: number;
  coverage_percent: number;
}

function filenameFromDisposition(disposition: string, fallback: string) {
  const lower = disposition.toLowerCase();
  const marker = "filename=";
  const index = lower.indexOf(marker);
  if (index < 0) return fallback;
  let value = disposition.slice(index + marker.length).split(";", 1)[0]?.trim() || "";
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value || fallback;
}

export function PrivateExportButton({
  sourceDate,
  label = "Exportar base completa",
  className = "private-export-trigger",
}: PrivateExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [exporting, setExporting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [needsPrivateBase, setNeedsPrivateBase] = useState(false);
  const [privateFile, setPrivateFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [installSuccess, setInstallSuccess] = useState("");
  const busy = exporting || installing;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword("");
    setError("");
    setInstallSuccess("");
    setNeedsPrivateBase(false);
    setPrivateFile(null);
  };

  const exportPrivateBase = async () => {
    if (!password.trim() || busy || needsPrivateBase) return;
    setExporting(true);
    setError("");
    setInstallSuccess("");
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
        if (response.status === 503 && message.includes("Base privada")) {
          setNeedsPrivateBase(true);
          setError("A cópia privada da última atualização ainda não está sincronizada no servidor.");
          return;
        }
        setPassword("");
        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = filenameFromDisposition(
        disposition,
        `SEPLAN_BASE_COMPLETA_${sourceDate || "atual"}.xlsx`,
      );
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
      setError(reason instanceof Error ? reason.message : "Falha ao exportar a base completa.");
    } finally {
      setExporting(false);
    }
  };

  const installPrivateBase = async () => {
    if (!privateFile || !password.trim() || busy) return;
    const lowerName = privateFile.name.toLowerCase();
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xlsm")) {
      setError("Selecione uma planilha .xlsx ou .xlsm.");
      return;
    }

    setInstalling(true);
    setError("");
    setInstallSuccess("");
    try {
      const response = await fetch("/api?action=private-base-upload", {
        method: "POST",
        headers: {
          "Content-Type": privateFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "X-SEPLAN-Admin-Password": password,
          "X-SEPLAN-Source-Name": encodeURIComponent(privateFile.name),
          Accept: "application/json",
        },
        body: privateFile,
      });
      const payload = await response.json() as PrivateBaseInstallResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Falha ao sincronizar a última base (${response.status}).`);
      }

      setNeedsPrivateBase(false);
      setPrivateFile(null);
      setPassword("");
      setInstallSuccess(
        `Última base sincronizada: ${payload.private_rows.toLocaleString("pt-BR")} registros privados preservados; ` +
        `${payload.matched_rows.toLocaleString("pt-BR")} de ${payload.public_rows.toLocaleString("pt-BR")} protocolos da versão publicada conferidos (${payload.coverage_percent.toLocaleString("pt-BR")}%).` +
        (payload.missing_private_rows ? ` ${payload.missing_private_rows.toLocaleString("pt-BR")} protocolo(s) públicos ficaram sem complemento privado.` : " Cobertura pública completa."),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao sincronizar a última base.");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        title="Exportar XLSX completo da última atualização, com nomes, responsáveis e observações"
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
          <section className={`private-export-modal ${needsPrivateBase ? "needs-private-base" : ""}`} role="dialog" aria-modal="true" aria-labelledby="private-export-title">
            <button type="button" className="private-export-close" onClick={close} aria-label="Fechar">×</button>
            <span className="private-export-icon" aria-hidden="true">⇩</span>
            <small>ACESSO RESTRITO</small>
            <h2 id="private-export-title">Exportar base completa</h2>
            <p>O XLSX corresponde à última atualização publicada e contém nomes, responsáveis, observações de abertura e do último trâmite, além das abas de cálculo dos indicadores. A senha é validada somente no servidor.</p>
            <label>
              <span>Senha administrativa</span>
              <input
                type="password"
                value={password}
                autoFocus
                autoComplete="current-password"
                placeholder="Informe a senha"
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !needsPrivateBase) void exportPrivateBase(); }}
              />
            </label>

            {error ? <div className="private-export-error">{error}</div> : null}
            {installSuccess ? <div className="private-export-success">{installSuccess}<br />Informe a senha novamente para gerar o XLSX.</div> : null}

            {needsPrivateBase ? (
              <div className="private-export-recovery">
                <strong>Sincronização da última atualização pendente</strong>
                <p>Esta recuperação só aparece quando uma versão antiga foi publicada sem sua cópia privada. Selecione <b>a mesma planilha usada na última atualização</b>. O relatório atual do IPM com aba <b>Report</b> é aceito.</p>
                <p className="private-export-privacy">Em uso normal isso não será necessário: a rotina de atualização passou a sincronizar automaticamente a mesma fonte. CPF/CNPJ não é armazenado.</p>
                <label className="private-export-file">
                  <span>Planilha da última atualização</span>
                  <input
                    type="file"
                    accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                    disabled={busy}
                    onChange={(event) => setPrivateFile(event.target.files?.[0] || null)}
                  />
                </label>
                {privateFile ? <small className="private-export-file-name">{privateFile.name} · {(privateFile.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB</small> : null}
                <button type="button" className="primary-button" onClick={() => void installPrivateBase()} disabled={busy || !privateFile || !password.trim()}>
                  {installing ? "Validando e sincronizando…" : "Sincronizar última base"}
                </button>
              </div>
            ) : null}

            <div className="private-export-actions">
              <button type="button" className="ghost-button" onClick={close} disabled={busy}>Cancelar</button>
              <button type="button" className="primary-button" onClick={() => void exportPrivateBase()} disabled={busy || !password.trim() || needsPrivateBase}>
                {exporting ? "Gerando arquivo…" : "Exportar XLSX completo"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
