import { statusTone } from "../format";
import type { IndicatorCoverage as Coverage } from "../types";

interface IndicatorCoverageProps {
  items: Coverage[];
}

export function IndicatorCoverage({ items }: IndicatorCoverageProps) {
  const available = items.filter((item) => item.status === "DISPONÍVEL").length;
  return (
    <section className="coverage-section">
      <div className="page-hero simple-hero">
        <div>
          <span className="eyebrow">CARTEIRA DE INDICADORES</span>
          <h1>O que já podemos medir com segurança</h1>
          <p>Cobertura explícita evita transformar ausência de fonte em número inventado.</p>
        </div>
        <div className="coverage-score"><strong>{available}/{items.length}</strong><span>indicadores disponíveis</span></div>
      </div>
      <div className="coverage-grid">
        {items.map((item) => (
          <article className="coverage-card" key={item.id}>
            <div><span>{item.id}</span><span className={`status-badge ${statusTone(item.status)}`}>{item.status}</span></div>
            <h2>{item.name}</h2>
            <p>{item.reason}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
