import { statusTone } from "../format";
import type { IndicatorCoverage as Coverage, PageId } from "../types";

interface IndicatorCoverageProps {
  items: Coverage[];
}

const KPI_PAGE: Record<string, PageId> = {
  KPI04: "kpi04",
  KPI05: "kpi05",
  KPI06: "kpi06",
  KPI07: "kpi07",
  KPI08: "kpi08",
  KPI09: "kpi09",
  KPI10: "kpi10",
  KPI11: "kpi11",
};

export function IndicatorCoverage({ items }: IndicatorCoverageProps) {
  const available = items.filter((item) => item.status === "DISPONÍVEL").length;
  return (
    <section className="coverage-section">
      <div className="page-hero simple-hero">
        <div>
          <span className="eyebrow">CARTEIRA DE INDICADORES</span>
          <h1>O que já podemos medir com segurança</h1>
          <p>Cobertura explícita evita transformar ausência de fonte em número inventado. Os indicadores 4–11 abrem em painéis próprios.</p>
        </div>
        <div className="coverage-score"><strong>{available}/{items.length}</strong><span>indicadores disponíveis</span></div>
      </div>
      <div className="coverage-grid">
        {items.map((item) => {
          const target = KPI_PAGE[item.id];
          return (
            <article className={`coverage-card ${target ? "is-navigable" : ""}`} key={item.id}>
              <div><span>{item.id}</span><span className={`status-badge ${statusTone(item.status)}`}>{item.status}</span></div>
              <h2>{item.name}</h2>
              <p>{item.reason}</p>
              {target ? <a className="ghost-button" href={`#/${target}`}>Abrir painel</a> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
