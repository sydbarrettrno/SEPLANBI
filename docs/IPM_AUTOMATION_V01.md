# Pipeline automática IPM — V01

## Objetivo e limite

Depois do upload, o agendador do Supabase consulta as importações pendentes a cada minuto e chama um worker Python na Vercel. O banco concede um lease a uma única execução por vez. O worker pode retomar uma importação já salva sem novo upload. A aprovação humana, o recálculo dos indicadores e a publicação do BI continuam em gates separados.

## Estado desta versão

Código e migração estão preparados, mas **a automação não está ativa** até serem configurados os segredos, aplicada a migração, publicada a Edge Function V04 e validado o Preview. A interface mantém o processamento atual enquanto `VITE_IPM_AUTO_WORKER_ENABLED` não for `true`.

## Ativação em ordem

1. Revisar e aplicar `supabase/migrations/20260929181734_ipm_worker_lease_and_schedule.sql`. Ela habilita `pg_cron` e `pg_net`, adiciona lease/tentativas e agenda um disparo por minuto. O agendador não envia HTTP sem os três segredos no Vault.
2. Publicar `supabase/functions/seplanbi-ipm/index.ts` como nova versão da Edge Function, preservando a autenticação OIDC Vercel → Supabase.
3. Criar um valor aleatório forte para `SEPLANBI_IPM_WORKER_SECRET` na Vercel e guardar **o mesmo valor** no Vault como `seplanbi_worker_token`. Não registrar o valor em Git, logs ou conversa.
4. Configurar no Vault `seplanbi_worker_url` como URL HTTPS fixa da implantação apropriada com `/api?action=ipm-worker`.
5. Configurar o segredo de Protection Bypass for Automation da Vercel no Vault como `seplanbi_vercel_bypass_token`. O header permite que o agendador atravesse a proteção do deployment sem desabilitá-la para visitantes. Restringir e rotacionar esse segredo no painel da Vercel.
6. Validar em Preview com execução de teste controlada. Confirmar uma única concessão de lease, contagem fechada, status `ready_for_review`, ausência de duplicação em nova tentativa e `protocols` intacta.
7. Só após o gate anterior, ativar `VITE_IPM_AUTO_WORKER_ENABLED=true` no deployment que receberá os uploads. A partir daí o navegador apenas consulta o status.

## Retomada e falhas

- Lease expira em cinco minutos se a Function for interrompida.
- Falha com retorno libera o lease e aplica espera crescente; após cinco tentativas, a importação fica `failed` para investigação, sem promoção.
- A classificação do bootstrap continua conferida contra o lote auditado de 3.170 → 3.310. A rotina não aprova nem publica resultados.
- O agendamento usa o Supabase Cron porque o Vercel Cron no plano Hobby só permite frequência diária. Não há dependência de uma aba aberta.

## Verificação operacional

Consultar `ipm_import_runs.status`, `worker_attempts`, `worker_lease_until`, `worker_last_error`, as contagens em `ipm_stage_protocols` e os registros em `cron.job_run_details` / `net._http_response`. Não considerar HTTP 200 ou deployment READY como aprovação da base.
