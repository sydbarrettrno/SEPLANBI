"""Validate the canonical project plan and render its human readable checkpoint."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "project" / "plan_V01.json"
TARGET = ROOT / "docs" / "PROJECT_STATE.md"


def render(plan):
    tasks = plan["tasks"]
    ids = {task["id"] for task in tasks}
    assert len(ids) == len(tasks), "IDs duplicados"
    assert plan["currentTaskId"] in ids
    phases = {phase["id"] for phase in plan["phases"]}
    statuses = {"concluido", "em_execucao", "bloqueado", "pendente", "nao_iniciado"}
    for task in tasks:
        assert task["phase"] in phases, task["id"]
        assert task["status"] in statuses, task["id"]
        assert set(task["dependsOn"]) <= ids - {task["id"]}, task["id"]
        assert task["status"] != "concluido" or task["evidence"] and task["actualEnd"], task["id"]
        assert task["status"] == "concluido" or not task["actualEnd"], task["id"]
    done = set()
    while len(done) < len(tasks):
        ready = {task["id"] for task in tasks if task["id"] not in done and set(task["dependsOn"]) <= done}
        assert ready, "Ciclo nas dependências"
        done.update(ready)

    current = next(task for task in tasks if task["id"] == plan["currentTaskId"])
    complete = sum(task["status"] == "concluido" for task in tasks)
    lines = [
        f"# Estado do projeto {plan['project']} — {plan['version']}",
        "",
        f"Gerado de `project/plan_V01.json`. Corte: {plan['asOf']}. Este arquivo não é editado manualmente.",
        "",
        f"**MVP:** {plan['mvpDefinition']}",
        f"**Prazo:** {plan['schedule']['target']} — {plan['schedule']['kind']} (confiança {plan['schedule']['confidence']}).",
        f"**Premissas:** {plan['schedule']['basis']}",
        f"**Cobertura de gates:** {complete}/{len(tasks)} tarefas concluídas ({round(complete / len(tasks) * 100)}% por contagem simples; não mede esforço).",
        "",
        f"## Etapa atual — {current['id']} · {current['name']}",
        "",
        f"- Objetivo: {current['objective']}",
        f"- Gate: {current['gate']} — {current['criterion']}",
        f"- Prazo estimado: {current['plannedEnd']}",
        f"- Bloqueio: {current.get('blocker', 'Nenhum registrado')}",
        f"- Próxima ação: {current['nextAction']}",
        "",
        "## Plano até o MVP",
        "",
        "| Fase | Tarefa | Estado | Prazo | Dependências | Gate | Evidência |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for task in tasks:
        evidence = "; ".join(task["evidence"]) if task["evidence"] else "Pendente"
        lines.append(f"| {task['phase']} | {task['id']} {task['name']} | {task['status']} | {task['plannedEnd'] or 'não documentado'} | {', '.join(task['dependsOn']) or '—'} | {task['gate']} | {evidence} |")
    lines += ["", "## Atualização", "", "1. Edite apenas `project/plan_V01.json`, com evidência e data real para qualquer tarefa concluída.", "2. Execute `python scripts/render_project_state.py` e valide o diff.", "3. Gates humanos só mudam após decisão documentada. Commits e deployments são evidências, não aprovação automática.", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    plan = json.loads(SOURCE.read_text(encoding="utf-8"))
    content = render(plan)
    if "--check" in sys.argv:
        assert TARGET.exists() and TARGET.read_text(encoding="utf-8") == content, "PROJECT_STATE.md desatualizado"
        print("Plano válido e PROJECT_STATE.md sincronizado")
    else:
        TARGET.write_text(content, encoding="utf-8")
        print(f"Gerado {TARGET.relative_to(ROOT)}")
