# ORCHESTRATION STATE SEPLANBI V07

## Estado consolidado

- Data do checkpoint: 29/08/2026.
- Prioridade dominante: incorporar a fonte `Base29082026.xlsx` sem perder memória V07 nem inflar o indicador de movimentos.
- Status da entrega local: `CONCLUIDA_NO_ESCOPO_AUTORIZADO`.
- Status da homologação administrativa: `PENDENTE`.
- Status de Git remoto, Vercel e produção: `NAO_ALTERADOS`.
- Dataset local: 7.063 protocolos, fonte atualizada até 28/08/2026.

## Objetivo e escopo

Atualizar a base local do SEPLANBI com a nova exportação IPM, preservar categoria e macroprocesso históricos, analisar os protocolos novos, atualizar os status dos protocolos movimentados e registrar eventos sanitizados para o indicador de tramitações/diligências.

Incluído:

- integridade e estrutura da nova fonte;
- diagnóstico e correção do falso delta causado por campo volátil;
- migração controlada da impressão digital V02 para V03;
- auditoria técnica assistida de 155 linhas;
- aplicação local com backup;
- validação de memória, eventos, privacidade, indicadores e idempotência;
- template privado V03;
- atualização de testes e documentação.

Excluído sem nova autorização:

- homologação administrativa;
- commit e push;
- substituição no GitHub remoto;
- deployment, promoção ou alteração da Vercel;
- validação da interface publicada.

## Baseline preservado

- Base anterior: 7.020 protocolos.
- Fonte anterior comprovada por SHA-256 registrado no dataset.
- Eventos anteriores: 241.
- Hash canônico anterior: `a85b4741148401cee2947e75f4623b072909e74e1c4e40f9949e59cb38531a35`.
- Backup privado pré-aplicação: `metadata.json` e 16 chunks, com hash do metadado conferido.
- Git remoto e produção: preservados.

## Resultado obtido

- Fonte nova: 7.063 protocolos.
- Novos: 43.
- Históricos alterados: 112.
- Históricos inalterados: 6.908.
- Removidos: zero.
- Categorias históricas alteradas: zero.
- Macroprocessos históricos alterados: zero.
- Eventos acrescentados: 155.
- Tramitações acrescentadas: 68.
- Diligências acrescentadas: 16.
- Eventos contáveis acrescentados: 84.
- Eventos totais: 396.
- Eventos contáveis totais: 236.
- Hash canônico final: `faac00c398a24bf5f18e19eb2743534cea55624b88d147947560dd4a634ffffe`.

## Tentativas relevantes

### T01 — comparação com impressão digital V02

- Alvo: detectar o delta da nova fonte.
- Hipótese inicial: todos os protocolos marcados haviam mudado.
- Resultado: descartada; 7.020 alterados em dois dias não era plausível.
- Evidência: `Última Atividade` mudou para 7.018 protocolos, normalmente somando três dias ao contador textual.
- Decisão: excluir o campo volátil e migrar a impressão digital com o relatório anterior comprovado por hash.

### T02 — comparação com impressão digital V03

- Alvo: detectar o delta sem o contador relativo.
- Resultado: 43 novos e 112 históricos alterados.
- Evidência esperada e obtida: zero removidos, 155 linhas de auditoria e fonte anterior validada.
- Equivalência com T01: não equivalente; o mecanismo da impressão digital foi corrigido.

### T03 — primeira validação após aplicação

- Alvo: executar testes e validação de indicadores.
- Resultado: seis testes e o validador falharam apenas por expectativas fixas da base de 7.020 protocolos.
- Correção: atualizar os snapshots para os valores comprovados da nova base, sem alterar fórmulas de KPI.
- Resultado final: 27 de 27 testes aprovados.

## Decisões semânticas materiais

1. Os 7.020 protocolos históricos mantiveram categoria e macroprocesso.
2. Os 43 novos foram alocados em categorias existentes da V07.
3. Cinco classificações contextuais foram destacadas para homologação: `43276/2026`, `43357/2026`, `43410/2026`, `43443/2026` e `43473/2026`.
4. `41474/2026` e `41698/2026` preservaram a separação entre encerramento formal e conclusão operacional.
5. Somente `TRAMITACAO` e `DILIGENCIA` contam no indicador de movimentos.
6. `Última Atividade` não integra mais a impressão digital, por ser contador relativo e não evento.

## Validações

- 27 de 27 testes automatizados aprovados.
- Privacidade e minimização aprovadas.
- 7.063 protocolos únicos.
- 396 eventos publicados.
- 236 eventos contáveis.
- Zero campos privados no payload.
- Zero conflitos de categoria histórica.
- Zero conflitos de macroprocesso histórico.
- Zero protocolos removidos.
- Hash da fonte confere com o metadado.
- Idempotência aprovada com zero eventos adicionados na reconferência.
- Auditoria XLSX verificada estruturalmente e visualmente.

Indicadores locais conferidos:

- recebidos em 2026: 2.898;
- concluídos operacionais: 2.214;
- concluídos formais: 1.920;
- estoque: 2.265;
- análise interna: 1.555;
- espera externa: 679;
- suspensos: 31;
- parados acima de 30 dias: 1.083;
- percentual parado sobre a fila interna: 69,6%;
- mediana de prazo: 54,0 dias;
- percentil 90: 228,7 dias.

## Arquivos alterados

- `data/README.md`;
- `data/metadata.json`;
- `data/final_chunks/part-000` a `part-015`;
- `scripts/atualizar_relatorio_ipm.py`;
- `scripts/validate.py`;
- `tests/test_core.py`;
- `tests/test_ipm_pipeline.py`;
- `docs/IPM_INCREMENTAL_PIPELINE_SEPLANBI_V03.md`;
- `docs/ORCHESTRATION_STATE_SEPLANBI_V07.md`.

Artefatos privados externos ao Git:

- auditoria preparada V04;
- auditoria revisada V05;
- `AUDITORIA_ATUALIZACAO_SEPLANBI_V03.xlsx`;
- backup da base anterior de 7.020 protocolos.

## Riscos residuais

- A revisão foi técnica e assistida; não houve homologação administrativa.
- Os cinco protocolos destacados possuem decisão contextual que merece conferência humana.
- A cobertura de movimentos continua limitada ao último trâmite observado entre extrações.
- O rollback foi materializado e verificado por hash, mas não foi restaurado sobre o repositório após a aplicação.
- O Git remoto e o site continuam com a versão anterior.

## Decisão do checkpoint Focus

Decisão: `CONCLUIR` o escopo local e manter publicação em gate.

Progresso material: nova base aplicada, memória histórica preservada, eventos acrescentados sem duplicação, validações aprovadas e rollback disponível.

Independência da revisão: autorrevisão do agente executor.

Nível de validação: estrutural, automatizado, visual, semântico assistido e de privacidade. Não executados: homologação administrativa e validação da publicação.

## Próxima ação

1. Conferir administrativamente o template V03.
2. Autorizar ou rejeitar commit e push.
3. Se autorizado, publicar o mesmo artefato e validar API, interface e logs.
