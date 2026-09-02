import defaultCopy from "./dashboard-copy.json";

export type DashboardCopy = typeof defaultCopy;
export const DEFAULT_DASHBOARD_COPY: DashboardCopy = defaultCopy;

export interface EditableCopyField {
  path: string;
  value: string;
  section: string;
  label: string;
}

const SECTION_LABELS: Record<string, string> = {
  sidebar: "Menu lateral",
  overview: "Visão executiva",
  received: "Recebidos",
  outputs: "Saídas",
  stock: "Estoque",
  processes: "Protocolos",
  indicators: "Indicadores",
  kpi04: "04 · Tempo de tramitação",
  kpi05: "05 · Processos parados",
  kpi06: "06 · Dentro do prazo",
  kpi07: "07 · Diligências",
  kpi08: "08 · Fiscalizações",
  kpi09: "09 · Denúncias",
  kpi10: "Projetos públicos",
  kpi11: "11 · Pendências",
  common: "Textos comuns",
  admin: "Administração",
};

const WORD_LABELS: Record<string, string> = {
  eyebrow: "Chamada superior",
  title: "Título",
  description: "Descrição",
  label: "Nome",
  caption: "Legenda",
  detail: "Ação / detalhe",
  reason: "Explicação",
  contextLabel: "Rótulo do menu",
  contextTitle: "Título do menu",
  footerTitle: "Rodapé do menu",
  footerCaption: "Legenda do rodapé",
  balanceLabel: "Rótulo do balanço",
  balancePressure: "Texto quando saldo é positivo",
  balanceOk: "Texto quando saldo não é positivo",
  trendSubject: "Assunto da tendência",
  detailSuffix: "Complemento do detalhe",
  detailPrefix: "Prefixo do detalhe",
  detailP90: "Rótulo do P90",
  peakIn: "Pico de entrada",
  peakOut: "Pico de entrega",
  valleyIn: "Menor entrada",
  empty: "Texto sem dados",
  howToTitle: "Título de orientação",
  howToText: "Texto de orientação",
  recordsetLabel: "Rótulo do recorte",
  allLabel: "Nome do recorte completo",
  availableSuffix: "Legenda de disponibilidade",
  current: "KPI atual",
  previous: "KPI anterior",
  previousDetail: "Detalhe da comparação",
  absolute: "Variação absoluta",
  absoluteDetail: "Detalhe da variação absoluta",
  percent: "Variação percentual",
  percentDetail: "Detalhe da variação percentual",
  total: "Total",
  concluded: "Concluídos",
  closed: "Encerrados",
  balance: "Saldo",
  balancePositive: "Saldo positivo",
  balanceNegative: "Saldo negativo",
  internal: "Fila interna",
  external: "Responsável externo",
  paralyzed: "Paralisado",
  depends: "Dependência da SEPLAN",
  dependsDetail: "Detalhe da dependência",
  reconciled: "Texto reconciliado",
  divergent: "Texto divergente",
  titleSuffix: "Complemento do título",
  defaultDescription: "Descrição padrão",
  selectedDescription: "Descrição com seleção",
  titleDefault: "Título padrão",
  titlePrefix: "Prefixo do título",
  chip: "Etiqueta",
  evolutionEyebrow: "Chamada da evolução",
  evolutionTitle: "Título da evolução",
  distributionEyebrow: "Chamada da distribuição",
  distributionTitle: "Título da distribuição",
  categoryEyebrow: "Chamada de categorias",
  categoryTitle: "Título de categorias",
  ageEyebrow: "Chamada de idade",
  ageTitle: "Título de idade",
  sectorEyebrow: "Chamada de setor",
  sectorTitle: "Título de setor",
  coverageTitle: "Título de cobertura",
  statusEyebrow: "Chamada de status",
  statusTitle: "Título de status",
  phaseEyebrow: "Chamada de etapas",
  phaseTitle: "Título de etapas",
  responsibilityEyebrow: "Chamada de responsabilidade",
  responsibilityTitle: "Título de responsabilidade",
  matrixEyebrow: "Chamada da matriz",
  matrixTitle: "Título da matriz",
  breadcrumbOverview: "Breadcrumb da visão executiva",
  breadcrumbIndicators: "Breadcrumb de indicadores",
  hardGateEyebrow: "Chamada de bloqueio",
  hardGateTitle: "Título de bloqueio",
  ruleLabel: "Rótulo de regra",
  drilldownEyebrow: "Chamada do drill-down",
  drilldownTitle: "Título do drill-down",
  loadingTitle: "Título de carregamento",
  loadingDescription: "Texto de carregamento",
  formEyebrow: "Chamada do formulário",
  formTitle: "Título do formulário",
  securityEyebrow: "Chamada de segurança",
  securityTitle: "Título de segurança",
  securityText: "Texto de segurança",
};

function friendlyLabel(path: string) {
  const parts = path.split(".");
  const leaf = parts[parts.length - 1];
  const parent = parts.length > 2 ? parts[parts.length - 2] : "";
  const base = WORD_LABELS[leaf] ?? leaf.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
  if (!parent || ["overview", "received", "outputs", "stock", "processes", "indicators", "common", "admin"].includes(parent)) return base;
  return `${parent.replace(/([A-Z])/g, " $1")} · ${base}`;
}

export function flattenDashboardCopy(copy: DashboardCopy): EditableCopyField[] {
  const fields: EditableCopyField[] = [];
  const walk = (value: unknown, path: string[]) => {
    if (typeof value === "string") {
      const fullPath = path.join(".");
      fields.push({
        path: fullPath,
        value,
        section: SECTION_LABELS[path[0]] ?? path[0],
        label: friendlyLabel(fullPath),
      });
      return;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
    }
  };
  walk(copy, []);
  return fields;
}

export function cloneDashboardCopy(copy: DashboardCopy): DashboardCopy {
  return JSON.parse(JSON.stringify(copy)) as DashboardCopy;
}

export function setDashboardCopyValue(copy: DashboardCopy, path: string, value: string): DashboardCopy {
  const next = cloneDashboardCopy(copy) as unknown as Record<string, unknown>;
  const parts = path.split(".");
  let cursor: Record<string, unknown> = next;
  for (const part of parts.slice(0, -1)) {
    const child = cursor[part];
    if (!child || typeof child !== "object" || Array.isArray(child)) throw new Error(`Caminho editorial inválido: ${path}`);
    cursor = child as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return next as unknown as DashboardCopy;
}
