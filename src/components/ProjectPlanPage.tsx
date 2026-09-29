import { useMemo, useState } from "react";
import plan from "../../project/plan_V01.json";
import "../project-plan.css";

type Task = (typeof plan.tasks)[number];
type View = "resumo" | "plano" | "cronograma" | "gates";

const views: { id: View; label: string }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "plano", label: "Plano" },
  { id: "cronograma", label: "Cronograma" },
  { id: "gates", label: "Gates" },
];

const statusLabels: Record<string, string> = {
  concluido: "Concluído",
  em_execucao: "Em execução",
  bloqueado: "Bloqueado",
  pendente: "Pendente",
  nao_iniciado: "Não iniciado",
};

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function dayDifference(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00Z`).getTime();
  const end = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((end - start) / 86400000);
}

function daysBetween(start: string, end: string): string {
  return `${dayDifference(start, end) + 1} d corridos`;
}

function criticalPath(tasks: Task[]): Set<string> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const memo = new Map<string, { length: number; path: string[] }>();
  function longest(id: string): { length: number; path: string[] } {
    const cached = memo.get(id);
    if (cached) return cached;
    const task = byId.get(id)!;
    const candidates = task.dependsOn.map(longest);
    const predecessor = candidates.sort((a, b) => b.length - a.length)[0];
    const duration = task.plannedStart && task.plannedEnd
      ? dayDifference(task.plannedStart, task.plannedEnd) + 1 : 0;
    const result = { length: (predecessor?.length ?? 0) + duration, path: [...(predecessor?.path ?? []), id] };
    memo.set(id, result);
    return result;
  }
  return new Set(longest(tasks[tasks.length - 1]!.id).path);
}

function Status({ task }: { task: Task }) {
  return <span className={`project-status project-status--${task.status}`}>{statusLabels[task.status]}</span>;
}

export function ProjectPlanPage() {
  const [view, setView] = useState<View>("resumo");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const tasks = plan.tasks;
  const current = tasks.find((task) => task.id === plan.currentTaskId)!;
  const completed = tasks.filter((task) => task.status === "concluido").length;
  const progress = Math.round(100 * completed / tasks.length);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const remaining = dayDifference(today, plan.schedule.target);
  const delayed = tasks.filter((task) => task.plannedEnd && task.plannedEnd < today && task.status !== "concluido");
  const visibleTasks = phaseFilter === "all" ? tasks : tasks.filter((task) => task.phase === phaseFilter);
  const critical = useMemo(() => criticalPath(tasks), [tasks]);
  const dates = useMemo(() => {
    const first = "2026-09-29";
    return Array.from({ length: dayDifference(first, plan.schedule.target) + 1 }, (_, index) => {
      const date = new Date(`${first}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    });
  }, []);

  return (
    <section className="project-plan-page" aria-label="Gestão do projeto SEPLANBI">
      <div className="project-topline"><span>GESTÃO DO DESENVOLVIMENTO · {plan.version}</span><span>Dados conferidos até {dateLabel(plan.asOf)}</span></div>
      <div className="project-hero">
        <div><span className="project-eyebrow">PLANO ATÉ O MVP</span><h1>SEPLANBI em execução</h1><p>{plan.mvpDefinition}</p></div>
        <div className="project-progress"><strong>{progress}%</strong><span>{completed} de {tasks.length} gates comprovados</span><div className="project-meter"><i style={{ width: `${progress}%` }} /></div><small>Contagem de tarefas; não representa horas trabalhadas.</small></div>
      </div>
      <div className="project-facts">
        <div><span>Meta estimada</span><strong>{dateLabel(plan.schedule.target)}</strong><small>{plan.schedule.kind}</small></div>
        <div><span>Tempo até a meta</span><strong>{remaining >= 0 ? `${remaining} dias` : `${-remaining} dias de atraso`}</strong><small>dias corridos; sujeito a revisão</small></div>
        <div><span>Etapa atual</span><strong>{current.id} · {current.name}</strong><small><Status task={current} /></small></div>
        <div><span>Tarefas vencidas</span><strong>{delayed.length}</strong><small>com prazo estimado vencido</small></div>
      </div>
      <nav className="project-tabs" aria-label="Visões do projeto">{views.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)} aria-current={view === item.id ? "page" : undefined}>{item.label}</button>)}</nav>

      {view === "resumo" && <div className="project-summary">
        <div className="project-focus-card"><span className="project-eyebrow">AGORA · {current.gate}</span><h2>{current.name}</h2><p>{current.objective}</p><dl><div><dt>Critério de saída</dt><dd>{current.criterion}</dd></div><div><dt>Prazo</dt><dd>{dateLabel(current.plannedEnd)} · estimado</dd></div><div><dt>Bloqueio</dt><dd>{current.blocker}</dd></div></dl><div className="project-next"><span>PRÓXIMA AÇÃO</span><strong>{current.nextAction}</strong></div></div>
        <div className="project-side"><h3>Marcos do MVP</h3>{plan.phases.map((phase) => { const phaseTasks = tasks.filter((task) => task.phase === phase.id); const done = phaseTasks.filter((task) => task.status === "concluido").length; return <div className="project-milestone" key={phase.id}><span className={done === phaseTasks.length ? "done" : ""}>{done === phaseTasks.length ? "✓" : `${done}/${phaseTasks.length}`}</span><div><strong>{phase.name}</strong><small>{phase.objective}</small></div></div>; })}<p className="project-note">{plan.schedule.basis}</p></div>
      </div>}

      {view === "plano" && <div className="project-panel"><div className="project-panel-head"><div><h2>Plano de execução</h2><p>Datas planejadas são estimativas; datas reais exigem evidência.</p></div><label>Fase <select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}><option value="all">Todas</option>{plan.phases.map((phase) => <option value={phase.id} key={phase.id}>{phase.name}</option>)}</select></label></div><div className="project-table-scroll"><table><thead><tr><th>Tarefa</th><th>Início previsto</th><th>Prazo</th><th>Início real</th><th>Fim real</th><th>Duração prevista</th><th>Duração real</th><th>% gate</th><th>Dependências</th><th>Responsável</th><th>Prioridade</th><th>Estado</th></tr></thead><tbody>{visibleTasks.map((task) => <tr key={task.id} className={task.id === current.id ? "current" : ""}><td><strong>{task.id}</strong> {task.name}</td><td>{dateLabel(task.plannedStart)}</td><td>{dateLabel(task.plannedEnd)}</td><td>{dateLabel(task.actualStart)}</td><td>{dateLabel(task.actualEnd)}</td><td>{task.plannedStart && task.plannedEnd ? daysBetween(task.plannedStart, task.plannedEnd) : "—"}</td><td>{task.actualStart && task.actualEnd ? daysBetween(task.actualStart, task.actualEnd) : "—"}</td><td>{task.status === "concluido" ? "100%" : "—"}</td><td>{task.dependsOn.join(", ") || "—"}</td><td>{task.owner}</td><td>{task.priority}</td><td><Status task={task} /></td></tr>)}</tbody></table></div><p className="project-footnote">“—” em progresso significa ausência de medição comprovada. Conclusão depende do gate, não de um percentual informado manualmente.</p></div>}

      {view === "cronograma" && <div className="project-panel"><div className="project-panel-head"><div><h2>Cronograma inicial</h2><p>Linha crítica calculada pelas dependências e durações estimadas. Ela será revista após G5.</p></div></div><div className="project-gantt-scroll"><div className="project-gantt" style={{ gridTemplateColumns: `220px repeat(${dates.length}, 27px)` }}><div className="project-gantt-label project-gantt-heading">Tarefa</div>{dates.map((date) => <div className="project-gantt-day" key={date} title={date}>{date.slice(8)}</div>)}{tasks.filter((task) => task.plannedStart && task.plannedEnd).map((task) => <div className="project-gantt-row" key={task.id} style={{ display: "contents" }}><div className="project-gantt-label" title={task.name}><strong>{task.id}</strong> {task.name}</div>{dates.map((date) => <div key={date} className={`project-gantt-cell ${date >= task.plannedStart! && date <= task.plannedEnd! ? "filled" : ""} ${critical.has(task.id) ? "critical" : ""} ${task.status === "concluido" ? "complete" : ""}`} title={`${task.id}: ${task.name} · ${date}`} />)}</div>)}</div></div><div className="project-legend"><span><i className="critical" /> Caminho crítico estimado</span><span><i /> Tarefa paralela</span></div></div>}

      {view === "gates" && <div className="project-gates">{tasks.map((task) => <article key={task.id} className={task.id === current.id ? "current" : ""}><div className="project-gate-title"><span>{task.gate} · {task.id}</span><Status task={task} /></div><h3>{task.name}</h3><p><strong>Critério:</strong> {task.criterion}</p><p><strong>Evidência:</strong> {task.evidence.length ? task.evidence.join("; ") : "Pendente"}</p>{task.blocker && <p className="project-gate-block"><strong>Bloqueio:</strong> {task.blocker}</p>}</article>)}</div>}
      <p className="project-data-note">Fonte do plano: <code>project/plan_V01.json</code> · Atualização por revisão do repositório; o painel não altera automaticamente a base IPM.</p>
    </section>
  );
}
