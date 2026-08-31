import { useEffect, useMemo, useState } from "react";
import { fetchExtendedIndicator } from "../api";
import type { ExtendedKpi, ExtendedResponse } from "../extended";
import type { DashboardFilters } from "../types";
import { StackedComposition, type VisualItem } from "./BiVisuals";

interface Props {
  kpi: ExtendedKpi;
  filters: DashboardFilters;
  onOwner?: (owner: string) => void;
}

const OWNER_TO_FILTER: Record<string, string> = {
  "Fila Interna SEPLAN": "Interno",
  "Aguardando Responsável Externo": "Externo",
  Paralisado: "Paralisado",
};

const OWNER_COLORS: Record<string, string> = {
  "Fila Interna SEPLAN": "#1871d5",
  "Aguardando Responsável Externo": "#63728b",
  Paralisado: "#c63f47",
};

export function IndicatorAuditSupplement({ kpi, filters, onOwner }: Props) {
  const [data, setData] = useState<ExtendedResponse | null>(null);
  const request = useMemo(() => ({
    kpi,
    from: filters.from,
    to: filters.to,
    year: filters.year,
    month: filters.month,
    macro: filters.macro,
    category: filters.category,
    status: filters.status,
    sector: filters.sector,
    q: filters.q,
    limit: 1,
  }), [filters, kpi]);

  useEffect(() => {
    if (![6, 8, 11].includes(kpi)) return;
    const controller = new AbortController();
    fetchExtendedIndicator(request, controller.signal)
      .then(setData)
      .catch(() => setData(null));
    return () => controller.abort();
  }, [kpi, request]);

  if (kpi === 6) {
    return (
      <section className="panel audit-requirements">
        <span className="eyebrow">REQUISITOS PARA HOMOLOGAÇÃO</span>
        <h2>O que falta para liberar o indicador de prazo</h2>
        <div className="requirement-grid">
          <div><strong>1. Prazo oficial por categoria</strong><p>Tabela normativa que defina quantos dias cada serviço possui.</p></div>
          <div><strong>2. Regra de suspensão</strong><p>Definir quando o relógio para por pendência externa, diligência ou documentação.</p></div>
          <div><strong>3. Marco inicial e final</strong><p>Homologar quais eventos iniciam e encerram a contagem de SLA.</p></div>
        </div>
        <p className="comparison-rule">Até esses três pontos existirem como regra oficial, nenhum processo será rotulado artificialmente como “no prazo” ou “fora do prazo”.</p>
      </section>
    );
  }

  if (kpi === 8) {
    const context = data?.context ?? {};
    return (
      <section className="panel audit-requirements">
        <span className="eyebrow">REQUISITOS PARA HOMOLOGAÇÃO</span>
        <h2>O que falta para medir fiscalizações realizadas</h2>
        <div className="requirement-grid">
          <div><strong>1. Evidência do ato</strong><p>Data e registro que comprovem a vistoria/fiscalização efetivamente executada.</p></div>
          <div><strong>2. Vínculo com o protocolo</strong><p>Identificador que conecte o ato realizado à demanda correspondente.</p></div>
          <div><strong>3. Resultado da fiscalização</strong><p>Tipo do ato e desfecho mínimo para evitar contar simples abertura como produção.</p></div>
        </div>
        {Object.keys(context).length ? <p className="comparison-rule">A base atual possui protocolos relacionados à fiscalização, mas eles permanecem apenas como contexto — nunca como fiscalizações realizadas.</p> : null}
      </section>
    );
  }

  if (kpi === 11 && data?.responsibilities?.length) {
    const items: VisualItem[] = data.responsibilities.map((item) => ({
      key: item.name,
      label: item.name,
      value: item.value,
      color: OWNER_COLORS[item.name],
    }));
    const selected = filters.owner
      ? Object.entries(OWNER_TO_FILTER).find(([, value]) => value === filters.owner)?.[0]
      : undefined;
    return (
      <section className="panel responsibility-pie-panel">
        <div className="panel-heading"><div><span className="eyebrow">COMPOSIÇÃO DAS PENDÊNCIAS</span><h2>Responsabilidade operacional</h2><p>Leitura proporcional do estoque pendente. Clique em uma fatia para cruzar os demais recortes.</p></div></div>
        <StackedComposition
          items={items}
          selected={selected}
          onSelect={(item) => onOwner?.(OWNER_TO_FILTER[item.key] ?? "")}
        />
      </section>
    );
  }

  return null;
}
