# ORCHESTRATION STATE SEPLANBI V09

## Estado consolidado

- Data do checkpoint: 29/08/2026.
- Prioridade dominante: corrigir a entrega XLSX para manter a base original dentro do mesmo arquivo que contém os dados atualizados do sistema.
- Status da V01: `SUPERADA_POR_ESCOPO_INCOMPLETO`.
- Status da V02: `CONCLUIDA_NO_ESCOPO_LOCAL_AUTORIZADO`.
- Status da homologação administrativa: `PENDENTE`.
- Status de Git remoto, Vercel e produção: `NAO_ALTERADOS`.

## Correção de escopo

A V01 preservou o arquivo-fonte externamente e entregou apenas a camada sanitizada de 7.063 protocolos. Essa estrutura não atendia ao requisito reiterado pelo usuário: a base original deveria permanecer juntamente com os dados atualizados para o sistema.

A V02 corrige o defeito sem excluir ou sobrescrever a V01:

- mantém os 10.966 registros e as 24 colunas originais da aba `Report`;
- reproduz a fonte na aba `ORIGINAL_IPM`;
- cria `BASE_COMPLETA` com as 24 colunas originais na mesma ordem e 14 campos adicionais do sistema;
- mantém `BASE_SISTEMA` como camada sanitizada separada;
- mantém `MOVIMENTOS`, `RESUMO` e `METADADOS`.

## Entregável vigente

- Arquivo: `BASE_SEPLANBI_COMPLETA_ATUALIZADA_29082026_V02.xlsx`.
- Local: diretório privado de saída da atualização de 29/08/2026.
- Tamanho: 6.801.003 bytes.
- SHA-256: `03041bf19b37d113bad7e688963e3480ec9272e95b30545a6384aa854be340f1`.
- Abas: `RESUMO`, `ORIGINAL_IPM`, `BASE_COMPLETA`, `BASE_SISTEMA`, `MOVIMENTOS` e `METADADOS`.

## Preservação comprovada

- Fonte: `Base29082026.xlsx`.
- SHA-256 da fonte: `3796018ca3dc7e489a12a0cade05c6555f61e540f3aec0f16f8185938ed18746`.
- Aba da fonte: `Report`.
- Linhas originais: 10.966 registros e um cabeçalho.
- Colunas originais: 24.
- Células comparadas, incluindo o cabeçalho: 263.208.
- Divergências entre a fonte e `ORIGINAL_IPM`: zero.
- Divergências entre a fonte e as primeiras 24 colunas de `BASE_COMPLETA`: zero.
- Hash normalizado célula a célula nas três matrizes: `f63cb6afc0512a4057a0187caa6eee6809ad577e397289a048934842dd022fd0`.

Normalização aplicada somente para o controle de igualdade: célula vazia e texto vazio são tratados como ausência equivalente. Valores, textos, datas, números, ordem, linhas e colunas foram comparados.

## Dados do sistema agregados

- Registros canônicos de 2025–2026: 7.063.
- Classificações históricas V07 preservadas: 7.020.
- Protocolos novos auditados: 43.
- Registros originais de 2024 preservados: 3.903.
- Registros de 2024 classificados pelo sistema: zero, porque estão fora do contrato canônico atual de 2025+.
- Colunas adicionais em `BASE_COMPLETA`: 14.
- Eventos registrados: 396.
- Tramitações: 196.
- Diligências: 40.
- Eventos contáveis: 236.

## Campos adicionais da BASE_COMPLETA

1. `ProtocoloID_Sistema`;
2. `EscopoSistema`;
3. `DataAbertura_Sistema`;
4. `UltimoTramiteData_Sistema`;
5. `DataEncerramentoFormal_Sistema`;
6. `Macroprocesso_Sistema`;
7. `Categoria_Sistema`;
8. `StatusOperacional_Sistema`;
9. `OrigemClassificacao_Sistema`;
10. `MovimentosRegistrados`;
11. `TramitacoesRegistradas`;
12. `DiligenciasRegistradas`;
13. `UltimoTipoEventoRegistrado`;
14. `DataUltimoEventoRegistrado`.

## Validação

- 27 de 27 testes automatizados do repositório aprovados.
- Validador do dataset: `VALIDADO`.
- Gate da camada pública: `PRIVACIDADE_E_MINIMIZACAO_APROVADAS`.
- Arquivo final existe e foi reaberto após a exportação.
- Estrutura e ordem das seis abas conferidas.
- Linhas iniciais e finais das bases original, completa, sistema e movimentos conferidas.
- Fórmulas do resumo reconciliadas.
- Nenhum erro `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?` ou `#N/A` localizado.
- Todas as seis abas renderizadas e inspecionadas visualmente.
- Defeito visual do SHA-256 no resumo corrigido antes da entrega.

## Privacidade e publicação

- `ORIGINAL_IPM` e `BASE_COMPLETA` contêm nomes, CPF/CNPJ e observações livres.
- A V02 é um arquivo privado e não pode ser enviada ao repositório público.
- `BASE_SISTEMA` continua representando a camada minimizada permitida no contrato público.
- O dashboard não consome a V02 diretamente; a API permanece vinculada ao artefato canônico em `data/final_chunks` e `data/metadata.json`.
- Nenhum commit, push ou deployment foi realizado.

## Limitações

- O histórico de movimentos começa em 22/08/2026.
- Cada extração IPM informa apenas o último trâmite observado; eventos intermediários entre extrações podem não ser recuperados.
- A revisão semântica foi técnica assistida e não equivale à homologação administrativa.

## Decisão do checkpoint Focus

Decisão: `CONCLUIR` a correção da entrega XLSX.

Progresso material: o requisito de preservação interna da base original foi comprovado por comparação célula a célula, e os dados atualizados foram agregados sem substituir as colunas de origem.

Independência da revisão: autorrevisão do agente executor.

Nível de validação: estrutural, automatizada, visual, semântica assistida e de preservação de dados.

## Próxima ação

1. Conferir administrativamente a V02.
2. Manter o arquivo em armazenamento privado.
3. Se houver necessidade de incorporar 2024 à camada canônica, abrir decisão semântica específica; não classificar automaticamente.
4. Se houver autorização de publicação, enviar somente o artefato minimizado e validar API e interface.
