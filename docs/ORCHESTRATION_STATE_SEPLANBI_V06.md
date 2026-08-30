# ORCHESTRATION STATE SEPLANBI V06

## Estado consolidado

- Data do checkpoint: 28/08/2026.
- Prioridade dominante: incorporar localmente o último relatório IPM com memória histórica V07 e trilha incremental de eventos.
- Status da entrega local: `CONCLUIDA_NO_ESCOPO_AUTORIZADO`.
- Status da homologação administrativa: `PENDENTE`.
- Status do Git remoto, Vercel e produção: `NAO_ALTERADOS`.
- Dataset local: 7.020 protocolos, com fonte atualizada até 26/08/2026.

## Objetivo e escopo inicial

Atualizar a base final usada pelo SEPLANBI segundo o último `Relatorio.xlsx`, preservando a categoria dos protocolos históricos, analisando a classificação dos novos protocolos, atualizando os status e registrando as movimentações necessárias ao indicador de tramitações/diligências.

Incluído neste checkpoint:

- identificação e integridade da última fonte recebida;
- comparação com a base canônica anterior;
- preservação da classificação histórica;
- análise dos 45 protocolos novos;
- auditoria dos 196 protocolos existentes com alteração;
- aplicação local do snapshot e dos eventos sanitizados;
- correção de idempotência;
- testes, privacidade, indicadores, documentação e rollback local.

Excluído sem autorização adicional:

- commit e push;
- substituição da base no GitHub remoto;
- deployment ou promoção na Vercel;
- homologação humana ou administrativa das decisões semânticas.

## Linha de base e fonte

- Linha de base anterior: 6.975 protocolos, corte em 22/08/2026.
- Fonte nova: 7.020 protocolos no escopo 2025+.
- Protocolos novos: 45.
- Protocolos existentes alterados: 196.
- Protocolos removidos: zero.
- SHA-256 do arquivo-fonte: `E9741710156B9964E18E8BC7FA3B60562F734981DCAD836CF6090A5BD16A69AD`.
- Arquivo original: preservado sem alteração.
- Backup pré-aplicação: preservado em área privada externa ao Git.

## Decisões aplicadas

1. `Categoria` e `Macroprocesso` dos 6.975 protocolos históricos foram preservados exatamente conforme a memória V07.
2. A classificação preliminar do IPM não foi tratada como verdade semântica para os 45 protocolos novos.
3. A análise dos novos protocolos utilizou o contexto disponível e alocou todos em categorias existentes da V07.
4. O protocolo `42867/2026` foi alocado em `Consulta`, com baixa confiança registrada e necessidade de homologação administrativa.
5. Somente `TRAMITACAO` e `DILIGENCIA` contam no indicador de quantidade de movimentos.
6. Eventos administrativos e cadastrais permanecem registrados, mas não contam no indicador.
7. O pipeline não executa Git, push, Vercel ou deploy.

## Resultado aplicado

- Protocolos publicados localmente: 7.020.
- Memória histórica recuperada: 6.975.
- Protocolos novos incluídos: 45.
- Protocolos existentes auditados por alteração: 196.
- Eventos registrados: 241.
- Tramitações: 128.
- Diligências: 24.
- Eventos contáveis no indicador: 152.
- Correções cadastrais: 28.
- Inclusões: 45.
- Encerramentos: 13.
- Reaberturas: 3.
- Categorias V07: 42.
- Macroprocessos: 12.
- Status operacionais: 7.
- Cobertura incremental de movimentos iniciada em 22/08/2026.
- Hash canônico final: `a85b4741148401cee2947e75f4623b072909e74e1c4e40f9949e59cb38531a35`.

## Tentativas e correções relevantes

1. A classificação preliminar deixou um protocolo novo em `Diversos`; a análise contextual identificou conteúdo de consulta e a decisão foi corrigida antes da aplicação final.
2. Os testes antigos continham expectativas fixas da base com 6.975 protocolos. As expectativas de snapshot foram atualizadas para 7.020, sem alteração das fórmulas de KPI.
3. A primeira aplicação revelou diferença de hash após reprocessamento porque a ordenação considerava segundos, mas o payload persistia minutos. A chave foi canonizada, foi criado teste de regressão e o backup pré-aplicação foi restaurado antes da aplicação final.
4. A conferência posterior à aplicação encontrou os 7.020 protocolos na memória, zero novos, zero alterados, zero eventos adicionados e o mesmo hash canônico.

## Validações executadas

- 26 de 26 testes automatizados aprovados.
- Validação de privacidade aprovada.
- Validação dos indicadores aprovada.
- Zero conflitos de categoria histórica.
- Zero conflitos de macroprocesso histórico.
- Zero protocolos removidos.
- Hash do arquivo-fonte preservado.
- Idempotência aprovada.
- `git diff --check` aprovado.
- Planilha privada de auditoria gerada e verificada estruturalmente.

Indicadores conferidos na base local:

- recebidos em 2026: 2.855;
- concluídos operacionais: 2.202;
- concluídos formais: 1.902;
- estoque: 2.233;
- em análise interna: 1.507;
- em análise externa: 695;
- suspensos: 31;
- parados acima de 30 dias: 1.079;
- percentual parado sobre a análise interna: 71,6%;
- mediana de prazo: 54,0 dias;
- percentil 90 de prazo: 228,9 dias.

## Arquivos do checkpoint

Arquivos novos ou modificados no repositório local:

- `.gitignore`;
- `data/README.md`;
- `data/metadata.json`;
- `data/final_chunks/part-000` a `part-015`;
- `scripts/ATUALIZAR_RELATORIO_IPM.bat`;
- `scripts/atualizar_relatorio_ipm.py`;
- `scripts/check_data_privacy.py`;
- `scripts/validate.py`;
- `tests/test_core.py`;
- `tests/test_ipm_pipeline.py`;
- `docs/IPM_INCREMENTAL_PIPELINE_SEPLANBI_V01.md`;
- `docs/IPM_INCREMENTAL_PIPELINE_SEPLANBI_V02.md`;
- `docs/ORCHESTRATION_STATE_SEPLANBI_V05.md`;
- `docs/ORCHESTRATION_STATE_SEPLANBI_V06.md`.

Artefatos privados externos ao Git:

- auditoria preparada em CSV;
- auditoria revisada em CSV;
- template `AUDITORIA_ATUALIZACAO_SEPLANBI_V02.xlsx`;
- backup integral dos chunks e metadados anteriores.

## Riscos e limitações residuais

- A revisão foi técnica e assistida; ainda não houve homologação administrativa.
- O protocolo `42867/2026` tem evidência textual insuficiente no extrato e deve ser priorizado na conferência humana.
- O IPM exporta somente o último trâmite observado; eventos intermediários entre duas extrações podem não ser recuperáveis.
- O indicador de movimentos tem cobertura incremental a partir de 22/08/2026 e não representa o histórico completo anterior.
- O repositório remoto e o site continuam exibindo a base anterior até autorização de commit, push e deployment.

## Decisão do checkpoint Focus

Decisão: `CONCLUIR` o escopo local autorizado e manter publicação em gate.

Justificativa: a base local está atualizada, minimizada, determinística, testada e pronta para revisão do diff. Os itens restantes são homologação administrativa e publicação, que exigem decisão do usuário e não são refinamentos técnicos implícitos.

Independência da revisão: autorrevisão do agente executor, sem revisor independente.

Nível de validação atingido: estrutural, automatizado, semântico assistido e de privacidade. Nível não atingido: homologação administrativa e validação da interface publicada.

## Próxima ação

1. Conferir a planilha de auditoria, especialmente os registros de baixa confiança.
2. Autorizar ou rejeitar o commit e o push da atualização local.
3. Se autorizado, publicar o mesmo artefato validado e conferir API, interface e logs.
