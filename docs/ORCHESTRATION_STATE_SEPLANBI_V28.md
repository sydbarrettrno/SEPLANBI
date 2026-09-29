# Estado de Orquestra — SEPLANBI V28

Data: 29/09/2026. Checkpoint de ativação parcial da pipeline IPM.

- `autorizacao`: usuário pediu prosseguir após o gate de migração e Edge Function.
- `supabase`: migração `ipm_worker_lease_and_schedule` aplicada; Edge Function `seplanbi-ipm` V04 ACTIVE; `pg_cron` agenda `seplanbi-ipm-worker` a cada minuto.
- `seguranca`: os três segredos `seplanbi_worker_url`, `seplanbi_worker_token` e `seplanbi_vercel_bypass_token` não existem no Vault; portanto, a função despachante retorna sem HTTP. A flag da interface permanece desligada.
- `vercel`: login para configurar `SEPLANBI_IPM_WORKER_SECRET` bloqueado pela revisão automática após indicação de senha anterior incorreta; nenhuma nova tentativa ou contorno foi feito.
- `dados`: execução `validating`, 3.310 em staging, tentativas do worker 0, contadores de comparação 0 e `protocols` 0. G5/G9 não concluídos; nenhum indicador recalculado.
- `validacao`: PR #28 com CI `success` e Preview READY; migração e versão da Edge confirmadas por consultas. Não houve teste ponta a ponta do agendamento.
- `proxima_acao`: após acesso seguro à configuração Vercel, criar segredo do worker e bypass de automação; configurar Vault, observar uma execução controlada e reconciliar contagens antes da flag.

Decisão Focus: **AGUARDAR ACESSO** à configuração de credenciais; não confundir cron ativo com atualização automática funcional.
