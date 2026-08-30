# Pipeline incremental IPM — SEPLANBI V02

## 1. Objetivo do checkpoint

Atualizar a base local consumida pelo SEPLANBI com o último `Relatorio.xlsx` recebido, preservando a classificação histórica dos protocolos existentes e submetendo os protocolos novos a análise semântica contextual antes da inclusão.

Esta versão registra a aplicação local realizada em 28/08/2026. Git remoto, Vercel e produção não foram alterados.

## 2. Fonte aplicada

- Arquivo de origem: `Relatorio.xlsx`, mantido fora do repositório.
- SHA-256: `E9741710156B9964E18E8BC7FA3B60562F734981DCAD836CF6090A5BD16A69AD`.
- Aba: `Report`.
- Registros no escopo 2025+: 7.020.
- Protocolos de 2025: 4.165.
- Protocolos de 2026: 2.855.
- Último trâmite observado: `2026-08-26 16:02:53`.
- Registros removidos em relação à memória: zero.

O arquivo original não foi modificado. Dados pessoais e observações livres permaneceram no ambiente privado e não foram incorporados ao payload público.

## 3. Classificação e memória histórica

### 3.1 Protocolos existentes

- 6.975 protocolos recuperaram `Categoria` e `Macroprocesso` diretamente da memória V07.
- Divergências de categoria histórica após a aplicação: zero.
- Divergências de macroprocesso histórico após a aplicação: zero.
- 6.779 protocolos não apresentaram alteração relevante.
- 196 protocolos apresentaram movimentação ou alteração cadastral e foram auditados sem reclassificação automática da categoria histórica.

### 3.2 Protocolos novos

- 45 protocolos foram incluídos.
- A classificação foi analisada pelo contexto disponível, priorizando `Último Trâmite`, `Observação de Abertura` e `Subassunto`.
- Todos foram alocados em categorias já existentes na taxonomia V07; nenhuma categoria ou macroprocesso novo foi criado.
- Não foi utilizada classificação por palavra isolada, expressão regular ou reaproveitamento do rótulo de outro protocolo.

Realocações materiais em relação ao rótulo preliminar do IPM:

- `42836/2026`: de assunto preliminar de largura de vias para `Consulta`;
- `42867/2026`: de `Diversos` para `Consulta`, com baixa confiança por insuficiência do conteúdo textual e ausência do anexo no extrato;
- `42882/2026`: de `Diversos` para `Consulta`;
- `42902/2026`: de `Diversos` para `Certidão de Uso e Ocupação do Solo`.

A revisão foi técnica e assistida pelo Codex. A homologação administrativa das decisões semânticas permanece pendente, especialmente no protocolo `42867/2026`.

## 4. Status e movimentos registrados

Foram incorporados 241 eventos sanitizados:

| Tipo de evento | Quantidade | Contável no indicador |
|---|---:|---|
| `TRAMITACAO` | 128 | Sim |
| `DILIGENCIA` | 24 | Sim |
| `INCLUSAO` | 45 | Não |
| `CORRECAO_CADASTRAL` | 28 | Não |
| `ENCERRAMENTO` | 13 | Não |
| `REABERTURA` | 3 | Não |
| **Total** | **241** | **152 contáveis** |

Reaberturas explicitamente registradas:

- `35104/2025`: `Cancelamento Administrativo` para `Em Análise`;
- `39344/2026`: `Certidões e Declarações` para `Em Análise`;
- `36950/2026`: `Habite-se` para `Em Análise`.

Dois encerramentos históricos que vieram vazios no novo relatório foram preservados contra regressão.

## 5. Contrato do artefato

O snapshot e os eventos sanitizados permanecem no mesmo transporte canônico `gzip+base64-chunks`.

- Protocolos publicados: 7.020.
- Eventos publicados: 241.
- Eventos contáveis: 152.
- Partes: 16, de `part-000` a `part-015`.
- SHA-256 canônico do GZIP: `a85b4741148401cee2947e75f4623b072909e74e1c4e40f9949e59cb38531a35`.
- Início da cobertura incremental de movimentos: `2026-08-22`.

Somente os tipos `TRAMITACAO` e `DILIGENCIA` compõem o indicador de quantidade de movimentos. Inclusões, encerramentos, reaberturas e correções cadastrais permanecem disponíveis para auditoria, sem inflar esse indicador.

## 6. Correção de determinismo

Durante a validação foi identificado que o snapshot armazenava o horário de evento com precisão de minuto, enquanto a chave de ordenação ainda considerava segundos. Isso podia alterar o hash após recarregar e reprocessar a mesma base.

A chave e a ordenação dos eventos foram canonizadas na precisão efetivamente publicada, e foi incluído teste de regressão. Após restauração do backup pré-aplicação e nova aplicação única, uma segunda conferência sem escrita produziu o mesmo hash canônico e adicionou zero eventos.

## 7. Validação V02

- Testes automatizados: 26 de 26 aprovados.
- Validação de privacidade: aprovada.
- Campos pessoais ou observações livres publicados: zero.
- Validação de indicadores: aprovada.
- Conferência de memória histórica: 6.975 acertos e zero conflitos de categoria/macroprocesso.
- Conferência de completude: 45 novos, 196 alterados, zero removidos.
- Conferência de idempotência: aprovada, com hash estável e zero eventos duplicados.
- Integridade do arquivo-fonte: hash original preservado.
- `git diff --check`: aprovado.

## 8. Limitações e estado de publicação

- O relatório IPM contém apenas o último trâmite observado por protocolo. Múltiplas tramitações ocorridas entre duas exportações podem não ser recuperadas.
- O indicador é confiável para os eventos efetivamente detectados desde `2026-08-22`, não para todo o histórico anterior do IPM.
- A planilha de auditoria contém contexto privado e permanece fora do Git.
- A revisão técnica assistida não equivale a homologação humana ou administrativa.
- Nenhum commit, push, deploy ou corte de produção foi executado neste checkpoint.

## 9. Próximo passo controlado

1. Conferir administrativamente as decisões do template, com prioridade para os registros de baixa confiança.
2. Revisar o diff de `data/`, código, testes e documentação.
3. Somente após autorização explícita, criar commit e substituir a base no GitHub.
4. Validar a API e a interface publicada após o deployment correspondente.
