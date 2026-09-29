# Gestão do desenvolvimento SEPLANBI — V01

## 1. Arquitetura e escopo

O gerenciamento do desenvolvimento tem um domínio próprio. O plano canônico fica em `project/plan_V01.json`, versionado no Git. O painel `#/project-plan` lê esse arquivo no build e aparece na seção Sistema para a sessão administrativa. `docs/PROJECT_STATE.md` é uma projeção legível do mesmo JSON; não é fonte independente. Nenhuma tabela foi adicionada ao Supabase para esse controle.

O painel possui somente Resumo, Plano, Cronograma e Gates. Não grava no banco IPM nem altera indicadores. Seu pacote contém somente metadados do projeto, sem dados pessoais ou observações de protocolos. A sessão administrativa controla a navegação, mas o JSON versionado no repositório público não deve receber segredos ou dados restritos.

## 2. Situação inicial verificada em 29/09/2026

- `main` termina em `d1d4560`, merge da atualização diária V02. Vercel registra deployment de produção `dpl_92HdcXkgzso2emUSmuy7hbXD316j` como READY.
- A V03 está em `feat/supabase-ipm-validation-v03`, commit `cc14929` e Preview READY `dpl_CdBtM3T2HfJPK7wu6YM7Ys8zvfVJ`.
- Supabase: uma execução em `validating`, 3.310 linhas declaradas e 3.310 em staging; `protocols`, `protocol_events` e `daily_indicators` ainda sem linhas.
- Os quatro contadores de comparação da execução ainda são zero e `validated_at` é nulo. O gate G5 não passou.
- `docs/ESTADO_EXECUCAO_V05.md` reflete 26/08; as versões históricas de orquestra foram preservadas.

## 3. Cronograma e leitura

O prazo de 23/10/2026 é **estimativa técnica de confiança baixa**, não meta aprovada. Parte de 29/09, encadeia tarefas em dias úteis e pressupõe decisão humana, nova extração IPM e autorização de corte. Após G5, reestimar. O percentual é `tarefas com gate comprovado / tarefas do MVP`, com peso igual; não mede esforço ou horas. Uma tarefa em curso exibe `—` no percentual individual, sem progresso fictício.

O caminho crítico apresentado é calculado pela maior soma de durações estimadas entre dependências até o gate final. É indicativo; não inclui capacidade da equipe, feriados, espera externa nem folgas reais.

## 4. Como atualizar

1. Antes de desenvolver, ler `project/plan_V01.json`, `docs/PROJECT_STATE.md` e conferir Git, Supabase e Vercel quando pertinentes.
2. Alterar a tarefa atual no JSON: status, datas reais, bloqueio, próxima ação, critério e evidência. Nunca marcar `concluido` sem data real e evidência; decisão humana exige registro próprio.
3. Se a nova evidência modificar a sequência, rever dependências e datas estimadas. Atualizar `currentTaskId` para uma ação executável.
4. Executar `python scripts/render_project_state.py` e `python scripts/render_project_state.py --check`.
5. Conferir o diff e executar `npm run build`. O CI impede que o resumo Markdown se afaste do JSON.
6. Criar a próxima versão de checkpoint `ORCHESTRATION_STATE_SEPLANBI_V26.md` após avanço material; não reescrever V25.

O Git fornece histórico de alterações, autor, data e revisão do plano. Commits, deployment READY, HTTP 200 e tabela existente são evidências técnicas; não aprovam automaticamente gates que exigem reconciliação ou decisão administrativa. Esta V01 não possui polling automático dos serviços: a atualização é feita pelo executor no checkpoint, com conferência obrigatória. Essa limitação é explícita para o painel não parecer atualizado em tempo real.

## 5. Próxima ação

Retomar a execução IPM já existente, sem reenviar o XLSX. Conferir se G5 produz contadores coerentes e diferenças inspecionáveis. Não aprovar a base oficial enquanto a revisão humana G7 não ocorrer.
