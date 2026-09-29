# Estado de Orquestra — SEPLANBI V27

Data: 29/09/2026. Checkpoint da publicação do código da pipeline IPM.

- `git`: branch `feat/ipm-worker-v01`, PR de rascunho #28 contra `feat/project-tracker-v01`, commit remoto `993eba68` com árvore idêntica ao commit local `b6320e6`.
- `preview`: deployment `dpl_9zJo7DjDz7PZuZyHQxNRuEbtgNd2` READY em `https://seplanbi-nh83sqeei-anibalnisgo.vercel.app`; status Vercel `success`. CI GitHub ainda estava em execução na conferência.
- `verificacao_local`: 7 testes de worker/segurança, build Vite, compilação Python, plano canônico e sintaxe SQL passaram. Ainda não é prova de funcionamento real do agendador.
- `estado_dos_dados`: a última conferência mantém 3.310 linhas no staging e zero protocolos oficiais; G5 e G9 não foram concluídos.
- `ativacao_pendente`: autorização e aplicação da migração no Supabase, publicação da Edge Function V04, segredo do worker na Vercel, três valores no Vault e teste controlado em Preview. A flag da interface permanece desligada.
- `limite`: nenhum dado promovido, nenhum indicador recalculado e nenhum corte de produção nesta etapa.
- `proxima_acao`: concluir a infraestrutura e verificar `ready_for_review`, contagens e retomada sem navegador antes de mudar o estado do gate.

Decisão Focus: **CONTINUAR** somente na ativação controlada e evidência real da pipeline.
