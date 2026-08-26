# DECISION LOG SEPLANBI V01

## D001 — evolução incremental

- Estado: APROVADA PARA PLANEJAMENTO
- Decisão: preservar ETL/backend e migrar o frontend progressivamente, em vez de reescrever tudo simultaneamente.
- Motivo: reduzir risco de divergência semântica e perda do processamento existente.

## D002 — origem do baseline

- Estado: RECOMENDADA; execução pendente do checkpoint S0
- Decisão: partir do commit publicado `24e1be66207d44c1085765ccb65105b9b890535c`.
- Motivo: há correspondência comprovada entre esse commit e os ativos da produção atual.
- Restrição: não importar automaticamente `apps/motor-cad` nem todas as branches/histórico sem auditoria.

## D003 — pipeline antes do React

- Estado: HARD GATE
- Decisão: comprovar Excel → artefato final → API antes de iniciar a migração visual.
- Motivo: o atualizador documentado e a API publicada usam transportes diferentes.

## D004 — datas de conclusão separadas

- Estado: HARD GATE SEMÂNTICO
- Decisão: não usar uma única coluna `DataConclusaoReal` como substituição silenciosa.
- Campos centrais: conclusão operacional, encerramento formal, fonte, confiança, versão da regra, revisão e data de referência do KPI.

## D005 — tratamento do anexo G2

- Estado: HIPÓTESE A REPRODUZIR
- Decisão: aproveitar a separação conceitual e os contraexemplos relatados, mas não aceitar amostra, números e reconciliação como comprovados sem os artefatos ou reprodução.

## D006 — frontend sem semântica própria

- Estado: APROVADA PARA ARQUITETURA
- Decisão: React consumirá dados e métricas versionadas da API; não reclassificará protocolos no navegador.

## D007 — painel administrativo separado dos KPI

- Estado: APROVADA PARA ARQUITETURA; tecnologia pendente
- Decisão: o administrador poderá alterar textos autorizados, não fórmulas ou resultados.
- Pendente: usuários, autenticação, persistência, aprovação, auditoria e rollback.

## D008 — escrita paralela controlada

- Estado: APROVADA
- Decisão: um executor escritor por área até o contrato da API estar congelado. Paralelismo somente para tarefas independentes e, quando necessário, em worktrees separados.

## D009 — skills canônicas

- Estado: EM VALIDAÇÃO
- Decisão: recriar os nomes históricos `organizer`, `execute`, `focus` e `estruturar-pedido-vago` como skills locais reais, com funções não sobrepostas.
- Motivo: o histórico relatava instalação, mas os artefatos não estavam disponíveis no catálogo atual.

## D010 — controle de consumo

- Estado: ATIVO
- Decisão: usar a meta da tarefa para consumo acumulado e registrar separadamente os percentuais de cota exibidos pela interface.
- Limitação: sem orçamento numérico informado, não existe cálculo de tokens restantes.

## D011 — produção preservada

- Estado: HARD GATE OPERACIONAL
- Decisão: não reconectar o projeto Vercel atual ao repositório novo durante baseline, desenvolvimento ou preview. A produção será alterada somente após homologação e autorização explícita de corte.
