# ORCHESTRATION STATE SEPLANBI V08

## Estado consolidado

- Data do checkpoint: 29/08/2026.
- Prioridade dominante: entregar a base local já atualizada em formato XLSX sanitizado e rastreável.
- Status da exportação XLSX: `CONCLUIDA_NO_ESCOPO_AUTORIZADO`.
- Status do dataset canônico local: `PRESERVADO`.
- Status da homologação administrativa: `PENDENTE`.
- Status de Git remoto, Vercel e produção: `NAO_ALTERADOS`.

## Objetivo e escopo

Materializar uma cópia tabular em Excel do dataset SEPLANBI atualizado pela fonte `Base29082026.xlsx`, preservando a classificação histórica V07 e separando os eventos observados para o indicador de tramitações/diligências.

Incluído:

- exportação dos sete campos sanitizados de protocolo;
- exportação dos quatro campos sanitizados de movimentos;
- resumo calculado, manifesto de rastreabilidade e limitações;
- validação estrutural, de contagens, fórmulas, privacidade e aparência visual.

Excluído sem nova autorização:

- alteração da fonte IPM original;
- homologação administrativa;
- commit, push, substituição remota ou deployment;
- alteração do contrato canônico consumido pela API.

## Entregável

- Arquivo: `BASE_SEPLANBI_ATUALIZADA_29082026_V01.xlsx`.
- Local: diretório privado de saída da atualização de 29/08/2026.
- Tamanho: 263.842 bytes.
- SHA-256 do XLSX: `d34b2933463d6491ae8b88f5e4feeef1046d39a1b90b8fff42fe009fe79cb1d7`.
- Abas: `RESUMO`, `BASE_PROTOCOLOS`, `MOVIMENTOS` e `METADADOS`.

## Reconciliação

- Protocolos: 7.063, todos únicos.
- Protocolos de 2025: 4.165.
- Protocolos de 2026: 2.898.
- Movimentos registrados: 396.
- Tramitações: 196.
- Diligências: 40.
- Eventos contáveis: 236.
- Demais eventos: 39 correções cadastrais, 27 encerramentos, 88 inclusões e 6 reaberturas.
- Campos privados localizados nos cabeçalhos publicados: zero.

## Rastreabilidade

- SHA-256 da fonte `Base29082026.xlsx`: `3796018ca3dc7e489a12a0cade05c6555f61e540f3aec0f16f8185938ed18746`.
- SHA-256 do artefato canônico local: `faac00c398a24bf5f18e19eb2743534cea55624b88d147947560dd4a634ffffe`.
- Taxonomia: V07, com 42 categorias, 12 macroprocessos e 7 status.
- A classificação existente foi preservada por protocolo; a revisão dos novos registros permanece identificada como técnica assistida, separada da homologação administrativa.

## Validação

- 27 de 27 testes automatizados do repositório aprovados.
- Validador do dataset: `VALIDADO`.
- Gate de privacidade e minimização: `APROVADO`.
- O arquivo final existe e foi reaberto após a exportação.
- Estrutura e ordem das quatro abas conferidas.
- Linhas iniciais e finais das abas de protocolos e movimentos conferidas.
- Quatro fórmulas do resumo preservadas e sem erros de referência, divisão, valor, nome ou indisponibilidade.
- Datas renderizadas como datas; identificadores preservados como texto.
- Todas as abas foram renderizadas e inspecionadas visualmente.
- Nomes, CPF/CNPJ, responsáveis técnicos, usuários e observações livres não foram incluídos nas tabelas públicas.

## Limitações e riscos residuais

- O XLSX é sanitizado, mas não anônimo: número de protocolo e datas continuam sendo identificadores indiretos e exigem tratamento compatível com a política institucional.
- O IPM informa apenas o último trâmite observado em cada extração; movimentos intermediários entre extrações podem não ser recuperados.
- O dashboard atual não consome este XLSX diretamente. A fonte canônica da API continua sendo `data/final_chunks` conforme `data/metadata.json`.
- Publicar somente o XLSX no GitHub não atualiza o site e não substitui o gate de commit, push e validação da publicação.

## Decisão do checkpoint Focus

Decisão: `CONCLUIR` a entrega XLSX local.

Progresso material: arquivo utilizável materializado, reconciliado e validado estrutural e visualmente.

Independência da revisão: autorrevisão do agente executor.

## Próxima ação

1. Conferir administrativamente o arquivo XLSX.
2. Manter o XLSX em área privada ou confirmar a política institucional para protocolo e datas.
3. Se a intenção for atualizar o site, autorizar separadamente commit e push do artefato canônico já preparado, seguido da validação da API e da interface.
