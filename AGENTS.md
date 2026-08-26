# AGENTS.md — SEPLANBI

## Idioma e comunicação

Responda em português do Brasil, de forma direta, técnica, organizada e rastreável. Em tarefas complexas, informe `Etapa X de N` e separe fatos comprovados, inferências, riscos, recomendações e próximo passo.

## Leitura obrigatória antes de agir

Leia integralmente, nesta ordem:

1. `docs/ORCHESTRATION_STATE_SEPLANBI_V*.md`, começando pela versão mais recente;
2. `docs/PROJECT_CHARTER_SEPLANBI_V*.md`;
3. `docs/DECISION_LOG_SEPLANBI_V*.md`;
4. `docs/ACCEPTANCE_CRITERIA_SEPLANBI_V*.md`.

Depois confira o estado real do Git. Não suponha que o último relato continua atual sem verificar.

## Orquestra

Use as skills canônicas quando disponíveis:

- `organizer`: prioridade, dependências, gates e estado;
- `execute`: uma unidade delimitada de implementação;
- `focus`: revisão independente entre checkpoints;
- `estruturar-pedido-vago`: somente quando ambiguidade material impedir planejamento seguro.

Mantenha uma prioridade dominante. Não faça `organizer`, `execute` e `focus` criarem planos concorrentes. Paralelize escrita somente quando as áreas forem independentes; prefira worktrees separados e um integrador responsável.

## Regras de execução

- Preserve o repositório de origem e a produção atual até autorização explícita de corte.
- Não inicie React antes de comprovar o pipeline Excel → artefato final → API e congelar o contrato dos KPI.
- Não altere fórmula de KPI silenciosamente.
- Mantenha conclusão operacional e encerramento formal separados.
- O frontend não deve reclassificar protocolos nem recalcular semântica.
- Não exponha Excel original, observações livres ou dados pessoais no repositório/deployment público.
- Após duas tentativas equivalentes sem progresso, mude a abordagem; após duas abordagens diferentes, solicite o dado ou a decisão essencial.
- Teste automatizado, HTTP 200, deployment READY e arquivo existente não equivalem a validação integral ou aprovação humana.
- Entregue uma versão 80% utilizável quando restarem apenas refinamentos marginais, sem ultrapassar hard gates de dados, privacidade, semântica, autorização, rastreabilidade ou rollback.

## Alterações e versões

- Preserve mudanças existentes do usuário.
- Use versões sequenciais `_V01`, `_V02`, `_V03` para documentos de controle.
- Atualize o estado de orquestra após cada checkpoint material; não sobrescreva a versão anterior.
- Registre arquivos alterados, testes, evidências, limitações, bloqueios e próxima ação.
- Não faça push, deploy, reconexão da Vercel, exclusão ou migração de produção sem autorização correspondente ao checkpoint.

## Baseline obrigatório

- Fonte publicada auditada: `https://github.com/sydbarrettrno/seplanitapoa`.
- Commit publicado de referência: `24e1be66207d44c1085765ccb65105b9b890535c`.
- O módulo `apps/motor-cad` é alheio ao dashboard e não deve ser importado automaticamente.
- O novo repositório deve começar com snapshot rastreável do dashboard; histórico adicional somente após auditoria.

## Condição atual

Consulte sempre o estado de orquestra mais recente. A existência deste arquivo não autoriza avanço automático para a próxima etapa.
