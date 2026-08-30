# Pipeline incremental IPM — SEPLANBI V03

## 1. Objetivo do checkpoint

Incorporar localmente a exportação `Base29082026.xlsx`, preservando a classificação histórica V07, analisando semanticamente os protocolos novos, atualizando status operacionais e acrescentando somente os movimentos comprovados pelo delta em relação à fonte anterior.

Esta versão registra a aplicação local realizada em 29/08/2026. Git remoto, Vercel e produção não foram alterados.

## 2. Fonte aplicada

- Arquivo: `Base29082026.xlsx`, mantido fora do repositório.
- SHA-256: `3796018CA3DC7E489A12A0CADE05C6555F61E540F3AEC0F16F8185938ED18746`.
- Aba: `Report`.
- Estrutura: 10.966 linhas de dados, 24 colunas e zero fórmulas.
- Registros no escopo 2025+: 7.063.
- Protocolos de 2025: 4.165.
- Protocolos de 2026: 2.898.
- Último trâmite observado: `2026-08-28 16:09:16`.
- Protocolos removidos: zero.

O arquivo original não foi modificado. Dados pessoais, endereços e observações livres permaneceram no ambiente privado e não foram incorporados ao payload público.

## 3. Correção da impressão digital operacional

A primeira comparação marcou incorretamente os 7.020 protocolos históricos como alterados. A causa comprovada foi o campo `Última Atividade`, que contém um contador relativo à data da exportação, por exemplo `Hoje`, `3 Dias` e `25 Dias`.

Esse contador avançou para 7.018 protocolos sem representar novo trâmite. A impressão digital foi atualizada para V03, excluindo o campo volátil.

A transição foi controlada:

1. o relatório privado anterior `Relatorio.xlsx` foi fornecido como baseline;
2. seu SHA-256 foi confrontado com o hash registrado no dataset vigente;
3. as impressões V03 do baseline foram reconstruídas por protocolo;
4. somente então a nova fonte foi comparada;
5. após a aplicação, a nova memória passou a usar V03 e não depende mais da fonte anterior.

O delta real foi reduzido de 7.063 linhas falsas para 155 linhas comprovadas.

## 4. Memória histórica

- Protocolos históricos encontrados: 7.020.
- Categorias históricas preservadas: 7.020.
- Conflitos de categoria: zero.
- Macroprocessos históricos preservados: 7.020.
- Conflitos de macroprocesso: zero.
- Protocolos históricos sem alteração: 6.908.
- Protocolos históricos com alteração auditada: 112.
- Encerramentos históricos preservados contra vazio: 3.

Nenhum protocolo existente foi reclassificado.

## 5. Protocolos novos

Foram incluídos 43 protocolos, todos classificados em categorias já existentes da taxonomia V07.

Distribuição das novas classificações:

| Categoria V07 | Quantidade |
|---|---:|
| Declaração de Não Oposição | 13 |
| Habite-se | 5 |
| Alvará de Construção | 4 |
| Desarquivamento de Protocolo | 4 |
| Alvará de Unificação | 3 |
| Alvará de Desdobro | 2 |
| Certidão de Uso e Ocupação do Solo | 2 |
| Demais categorias | 10 |
| **Total** | **43** |

Realocações materiais ou decisões que exigiram leitura contextual:

- `43276/2026`: `DIVERSOS` para `Certidão de Finalidade Urbana`, pois o pedido é a expedição de certidão declarando que a matrícula está em área urbana;
- `43357/2026`: `DENUNCIA` para `Defesa Administrativa`, pois o conteúdo é recurso contra auto de infração;
- `43410/2026`: `DIVERSOS` para `Engenharia e Infraestrutura`, por tratar de manutenção de iluminação pública; confiança moderada;
- `43443/2026`: `DECLARAÇÃO NÃO OPOSIÇÃO` para `Certidões e Declarações`, porque o último trâmite solicita certidão de inexistência de cadastro; confiança moderada;
- `43473/2026`: `DIVERSOS` para `Fiscalização`, por se tratar de pedido de providências sobre ocupação irregular de via pública; confiança moderada.

Não foi utilizada classificação por palavra isolada, expressão regular ou cópia do rótulo de outro protocolo. A revisão foi técnica e assistida; a homologação administrativa permanece pendente.

## 6. Eventos acrescentados

Foram acrescentados 155 eventos:

| Tipo | Acrescentados | Contável no indicador |
|---|---:|---|
| `TRAMITACAO` | 68 | Sim |
| `DILIGENCIA` | 16 | Sim |
| `INCLUSAO` | 43 | Não |
| `ENCERRAMENTO` | 14 | Não |
| `REABERTURA` | 3 | Não |
| `CORRECAO_CADASTRAL` | 11 | Não |
| **Total** | **155** | **84 contáveis** |

Após a atualização, o histórico sanitizado totaliza:

- 396 eventos;
- 236 tramitações/diligências contáveis;
- cobertura incremental iniciada em 22/08/2026.

Três reaberturas foram registradas neste delta:

- `52642/2025`;
- `27821/2026`;
- `29824/2026`.

Nos protocolos `41474/2026` e `41698/2026`, o encerramento formal no IPM não foi tratado como conclusão operacional: o último trâmite comprova encaminhamento a outro setor, e o status operacional ficou `Aguardando Terceiro/Setor`.

## 7. Artefato final

- Protocolos: 7.063.
- Eventos: 396.
- Eventos contáveis: 236.
- Partes: 16.
- SHA-256 canônico do GZIP: `faac00c398a24bf5f18e19eb2743534cea55624b88d147947560dd4a634ffffe`.
- Impressão digital operacional: V03.
- Taxonomia: V07, com 42 categorias, 12 macroprocessos e 7 status.

O payload continua publicando apenas os campos da allowlist. O novo campo `Det. Situação - Fluxo` foi disponibilizado somente na auditoria privada e não integra o payload público.

## 8. Validação V03

- Testes automatizados: 27 de 27 aprovados.
- Privacidade e minimização: aprovadas.
- Protocolos únicos: 7.063.
- Campos pessoais ou observações livres publicados: zero.
- Conflitos de categoria histórica: zero.
- Conflitos de macroprocesso histórico: zero.
- Protocolos removidos: zero.
- Fonte com hash preservado: aprovada.
- Idempotência: aprovada, com zero novos eventos e mesmo hash após reconferência.
- Planilha privada: quatro abas verificadas estruturalmente e visualmente.
- Rollback pré-aplicação: backup de `metadata.json` e 16 chunks com hash conferido.

## 9. Limitações e publicação

- O IPM continua fornecendo apenas o último trâmite observado. Eventos intermediários entre duas exportações podem não ser reconstruídos.
- Os 236 movimentos contáveis representam somente o histórico incremental observado desde 22/08/2026.
- A revisão técnica assistida não equivale a homologação administrativa.
- Protocolos classificados com confiança moderada devem ser priorizados na revisão humana.
- Nenhum commit, push, deployment ou corte de produção foi executado.

## 10. Próximo passo controlado

1. Homologar administrativamente a planilha privada, especialmente os cinco casos contextualizados.
2. Revisar o diff local do dataset, código, testes e documentação.
3. Somente após autorização explícita, criar commit e enviar ao GitHub.
4. Validar API, interface e logs no deployment correspondente.
