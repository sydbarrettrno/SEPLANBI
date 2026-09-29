# Estado do projeto SEPLANBI — V01

Gerado de `project/plan_V01.json`. Corte: 2026-09-29. Este arquivo não é editado manualmente.

**MVP:** Atualização diária IPM com arquivo original privado, comparação rastreável, revisão humana, promoção transacional, indicadores reconciliados e publicação controlada do BI.
**Prazo:** 2026-10-23 — PRAZO ESTIMADO — NÃO HOMOLOGADO (confiança baixa).
**Premissas:** Sequência técnica inicial em dias úteis a partir de 29/09/2026; depende da comparação, de homologação humana, de uma segunda extração IPM e do aceite do corte. Datas devem ser recalculadas após o primeiro gate real.
**Cobertura de gates:** 6/16 tarefas concluídas (38% por contagem simples; não mede esforço).

## Etapa atual — IPM-05 · Comparar baseline 3.170 → lote 3.310

- Objetivo: Contabilizar novos, alterados, iguais e ausentes
- Gate: G5 — Contadores fecham com o lote e diferenças por protocolo são inspecionáveis
- Prazo estimado: 2026-10-01
- Bloqueio: Comparação interrompida após o staging; execução anterior excedeu 10 s. Novo runtime com 60 s ainda precisa comprovar conclusão.
- Próxima ação: Retomar a execução existente e verificar os quatro contadores e a soma contra 3.310

## Plano até o MVP

| Fase | Tarefa | Estado | Prazo | Dependências | Gate | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| BASE | BASE-01 Baseline do BI e contrato público | concluido | não documentado | — | G0 | docs/ORCHESTRATION_STATE_SEPLANBI_V15.md; commit ee6596d |
| BASE | BASE-02 Atualização IPM V02 em produção | concluido | não documentado | BASE-01 | G0B | merge d1d4560 em main (28/09/2026); Vercel production READY dpl_92HdcXkgzso2emUSmuy7hbXD316j |
| IPM | IPM-01 Storage, tabelas e funções de validação | concluido | não documentado | BASE-02 | G1 | Supabase: tabelas e RLS verificados em 29/09; pg_proc: validate_ipm_import, approve_ipm_import e reject_ipm_import presentes |
| IPM | IPM-02 Conexão OIDC Vercel → Supabase | concluido | não documentado | IPM-01 | G2 | commits 03149d6 e 5cb9144 na V03; health 200 confirmado na sessão de 29/09; revalidação automatizada pendente |
| IPM | IPM-03 Upload original no Storage | concluido | não documentado | IPM-02 | G3 | Supabase ipm_import_runs: 1 execução, source_rows=3310, 29/09/2026 |
| IPM | IPM-04 Carregar 3.310 linhas em staging | concluido | não documentado | IPM-03 | G4 | Supabase: 3.310 linhas em ipm_stage_protocols; protocols=0 em 29/09 |
| IPM | IPM-05 Comparar baseline 3.170 → lote 3.310 | em_execucao | 2026-10-01 | IPM-04 | G5 | ipm_import_runs.status=validating; contadores ainda zerados em 29/09 |
| IPM | IPM-06 Validação automática e divergências | bloqueado | 2026-10-02 | IPM-05 | G6 | Pendente |
| IPM | IPM-07 Revisão humana da base | bloqueado | 2026-10-05 | IPM-06 | G7 | Pendente |
| IPM | IPM-08 Promoção transacional e histórico | bloqueado | 2026-10-06 | IPM-07 | G8 | Pendente |
| ROB | ROB-01 Execução por etapas persistentes | em_execucao | 2026-10-02 | IPM-04 | G9 | PR de rascunho #28, commit 993eba68; Preview Vercel READY; 7 testes locais e build passaram em 29/09/2026 |
| BI | BI-01 Recalcular indicadores após aprovação | bloqueado | 2026-10-09 | IPM-08 | G10 | Pendente |
| BI | BI-02 Publicar estado aprovado na API e tela | bloqueado | 2026-10-13 | BI-01, ROB-01 | G11 | Pendente |
| MVP | MVP-01 Segundo ciclo real de atualização | bloqueado | 2026-10-16 | BI-02 | G12 | Pendente |
| MVP | MVP-02 Segurança, privacidade e rollback | pendente | 2026-10-21 | MVP-01 | G13 | Pendente |
| MVP | MVP-03 Aceite e corte controlado do MVP | bloqueado | 2026-10-23 | MVP-02 | G14 | Pendente |

## Atualização

1. Edite apenas `project/plan_V01.json`, com evidência e data real para qualquer tarefa concluída.
2. Execute `python scripts/render_project_state.py` e valide o diff.
3. Gates humanos só mudam após decisão documentada. Commits e deployments são evidências, não aprovação automática.
