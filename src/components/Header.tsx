import { useEffect, useState } from "react";
import { formatDate, formatNumber } from "../format";
import logoMunicipio from "../../assets/logo-municipio-itapoa.png";

interface HeaderProps {
  sourceDate?: string;
  scopeRows?: number;
  onMenu: () => void;
}

interface UniverseSummary {
  total: number;
  stock: number;
  finalized: number;
  internal: number;
  external: number;
  paralyzed: number;
  reconciled: boolean;
}

interface HealthPayload {
  audit?: {
    rows?: number;
    unique_protocols?: number;
    stock?: number;
    internal_queue?: number;
    external_wait?: number;
    paralyzed?: number;
  };
}

function asCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function Header({ sourceDate, scopeRows, onMenu }: HeaderProps) {
  const [universe, setUniverse] = useState<UniverseSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api?action=health", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao consultar o universo da base.");
        return await response.json() as HealthPayload;
      })
      .then((payload) => {
        const audit = payload.audit ?? {};
        const total = asCount(audit.unique_protocols) ?? asCount(audit.rows);
        const stock = asCount(audit.stock);
        const internal = asCount(audit.internal_queue);
        const external = asCount(audit.external_wait);
        const paralyzed = asCount(audit.paralyzed);
        if (total == null || stock == null || internal == null || external == null || paralyzed == null) return;
        const finalized = total - stock;
        setUniverse({
          total,
          stock,
          finalized,
          internal,
          external,
          paralyzed,
          reconciled: finalized >= 0 && finalized + stock === total && internal + external + paralyzed === stock,
        });
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setUniverse(null);
      });
    return () => controller.abort();
  }, []);

  const structuralScopeActive = universe && scopeRows != null && scopeRows !== universe.total;

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
        <div className="universe-meta">
          <small>BASE ATUALIZADA</small>
          <details className="universe-details">
            <summary>
              {formatDate(sourceDate)} · {universe ? formatNumber(universe.total) : "—"} protocolos
              <span className="universe-info-icon" aria-hidden="true">i</span>
            </summary>
            <div className="universe-popover">
              <span className="universe-popover-eyebrow">UNIVERSO DA BASE</span>
              <strong>{universe ? `${formatNumber(universe.total)} protocolos únicos` : "Universo indisponível"}</strong>
              {universe ? (
                <>
                  <div className="universe-equation" aria-label="Reconciliação do universo da base">
                    <span><b>{formatNumber(universe.finalized)}</b><small>concluídos / encerrados</small></span>
                    <i aria-hidden="true">+</i>
                    <span><b>{formatNumber(universe.stock)}</b><small>pendentes atuais</small></span>
                    <i aria-hidden="true">=</i>
                    <span><b>{formatNumber(universe.total)}</b><small>protocolos</small></span>
                  </div>
                  <p>
                    Pendentes: {formatNumber(universe.internal)} internos · {formatNumber(universe.external)} externos · {formatNumber(universe.paralyzed)} paralisados.
                  </p>
                  {structuralScopeActive ? (
                    <p className="universe-scope-note">
                      Filtros estruturais ativos: {formatNumber(scopeRows)} protocolos pertencem ao recorte antes da leitura temporal.
                    </p>
                  ) : null}
                  <p className="universe-method-note">
                    Recebidos e saídas abaixo obedecem ao período selecionado. A pendência representa a posição atual da base em {formatDate(sourceDate)} e não deve ser somada aos fluxos do período.
                  </p>
                  <span className={universe.reconciled ? "universe-check ok" : "universe-check warning"}>
                    {universe.reconciled ? "✓ Universo reconciliado" : "⚠ Reconciliação divergente"}
                  </span>
                </>
              ) : (
                <p>Não foi possível carregar a decomposição do universo. Os indicadores do painel continuam disponíveis.</p>
              )}
            </div>
          </details>
        </div>
        <span className="live-pill"><i /> Dados validados</span>
      </div>
    </header>
  );
}
