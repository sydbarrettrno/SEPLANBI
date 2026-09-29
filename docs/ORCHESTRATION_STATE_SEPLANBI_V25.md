# Estado de Orquestra — SEPLANBI V25

Data: 29/09/2026. Escopo desta unidade: gestão persistente do projeto até o MVP.

- `objetivo`: disponibilizar uma fonte única de acompanhamento, cronograma inicial, dependências, gates e painel simples, sem mudar a pipeline IPM.
- `etapa_atual`: G5, comparar baseline auditado de 3.170 com lote de 3.310.
- `prioridade_dominante`: concluir G5 e apresentar diferenças verificáveis.
- `estado`: painel de gestão implementado localmente na branch `feat/project-tracker-v01`, a partir de `feat/supabase-ipm-validation-v03`.
- `fonte_canonica`: `project/plan_V01.json`.
- `resumo_derivado`: `docs/PROJECT_STATE.md`, gerado por `scripts/render_project_state.py`.
- `painel`: `#/project-plan`, quatro visões, visível após sessão administrativa. O dado do plano não é sigiloso e permanece no bundle público.
- `cobertura`: 6/16 tarefas com gate comprovado; 38% é contagem simples, sem equivalência a esforço.
- `prazo_mvp`: 23/10/2026, estimativa inicial de confiança baixa, não homologada.
- `evidencia_do_estado`: Git main `d1d4560`, V03 `cc14929`, Preview READY, Supabase com uma importação `validating`, 3.310 linhas em staging, zero em `protocols` e contadores ainda zerados.
- `bloqueio`: G5 ainda não concluído; runtime ampliado a 60 s precisa ser exercitado e reconciliado.
- `proxima_acao`: retomar a execução existente e reconciliar novos, alterados, iguais e ausentes sem reenviar XLSX.
- `limites`: nenhuma aprovação da base, alteração de indicadores, schema de gestão no Supabase, push, deploy ou corte de produção nesta unidade.
- `validacao`: build TypeScript/Vite e render SSR do painel passaram; navegador visual indisponível nesta sessão porque o daemon do agent-browser falhou e o download do Chromium veio truncado. Inspeção visual fica pendente antes de publicação.
- `arquivos`: `project/plan_V01.json`, `docs/PROJECT_STATE.md`, `docs/PROJECT_MANAGEMENT_V01.md`, este checkpoint, `scripts/render_project_state.py`, `src/components/ProjectPlanPage.tsx`, `src/project-plan.css`, rotas/tipos/menu, `AGENTS.md` e CI.

Decisão de foco: **CONTINUAR** após o gate de publicação do painel. O trabalho de gestão foi delimitado; a pipeline IPM permanece no G5.
