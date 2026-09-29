# Estado de Orquestra — SEPLANBI V26

Data: 29/09/2026. Escopo: retomada automática da importação IPM sem depender do navegador.

- `objetivo`: concluir upload → staging → comparação → validação automática de forma independente da sessão do usuário, preservando revisão humana antes da promoção.
- `prioridade_dominante`: ROB-01, worker agendado e retomável. G5 do lote de 3.310 permanece pendente.
- `entregue_localmente`: lease de importação, até cinco tentativas com espera crescente, endpoint autenticado na Vercel, Edge Function V04 versionada, agendamento Supabase preparado e interface com flag de ativação.
- `fonte_canonica`: `project/plan_V01.json`; resumo derivado `docs/PROJECT_STATE.md`.
- `validacao`: testes do worker, build e verificação do estado executados localmente; validação real de SQL, Edge, HTTP agendado e retomada do lote permanece pendente.
- `bloqueio`: três segredos operacionais não configurados (worker, URL, proteção do deployment); migração e Edge V04 ainda não publicadas. Não há pipeline automática ativa.
- `limites`: nenhum dado promovido, nenhum indicador recalculado, nenhuma alteração em produção; o fluxo atual do navegador segue como fallback enquanto a flag estiver desligada.
- `proxima_acao`: preparar configuração dos segredos e validar a automação em Preview antes de habilitar a flag.

Decisão Focus: **CONTINUAR** somente até o gate de infraestrutura e teste real; não adicionar novas funcionalidades de BI.
