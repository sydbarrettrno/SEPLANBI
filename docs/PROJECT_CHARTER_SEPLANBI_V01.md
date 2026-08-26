# PROJECT CHARTER SEPLANBI V01

## 1. Identificação

- Projeto: SEPLANBI — Painel Executivo e Operacional da SEPLAN Itapoá
- Versão: V01
- Data de corte: 26/08/2026
- Estado: EM ESTRUTURAÇÃO — CHECKPOINT S0
- Repositório de destino: https://github.com/sydbarrettrno/SEPLANBI
- Diretório local: `C:\SEPLANBI`
- Produção atual: https://seplan-bi-react.vercel.app/
- Fonte publicada auditada: https://github.com/sydbarrettrno/seplanitapoa
- Commit publicado de referência: `24e1be66207d44c1085765ccb65105b9b890535c`

## 2. Objetivo

Evoluir o dashboard existente para um sistema executivo e investigativo em React, orientado à gestão por exceção, preservando a base oficial, o processamento semântico válido, a rastreabilidade dos indicadores, os drill-downs e a atualização futura por Excel.

O projeto deve ajudar a gestão a percorrer:

```text
demanda → produção → saldo → estoque → tempo → gargalo → responsáveis → protocolos → ação
```

## 3. Diretriz principal

O sistema não será recriado do zero. A evolução será incremental:

1. formar baseline rastreável da produção atual;
2. corrigir e comprovar a atualização dos dados;
3. estabilizar semântica, KPI e contrato da API;
4. reproduzir a funcionalidade atual em React;
5. aplicar o visual executivo aprovado;
6. adicionar administração segura da camada textual;
7. homologar em ambiente separado;
8. executar corte de produção com rollback.

## 4. Público e decisões que o sistema deve apoiar

Públicos principais:

- Chefia de Gabinete e direção: leitura executiva em poucos segundos;
- gestores da SEPLAN: diagnóstico de estoque, tempo e gargalos;
- equipe operacional: identificação dos protocolos correspondentes;
- administrador autorizado: manutenção dos textos explicativos dos cards.

A primeira tela deve responder:

1. quanto entrou;
2. quanto foi concluído;
3. se a produção acompanhou a demanda;
4. quanto permaneceu em estoque;
5. onde está a prioridade de atuação.

## 5. Escopo incluído

- Preservação do backend Python, ETL e regras válidas durante a migração.
- Correção do fluxo Excel → artefato final → API.
- Contrato versionado dos indicadores.
- React + Vite + TypeScript no frontend.
- Visual institucional claro, com logotipo oficial.
- Gestão por exceção: normal discreto; atenção e crítico com contraste acessível.
- Tendência mensal e análise sazonal somente quando houver histórico suficiente.
- Filtros globais e filtros cruzados.
- Drill-down até os protocolos.
- Gráficos nos painéis de detalhes dos indicadores.
- Estados explícitos de carregamento, erro, vazio e dado indisponível.
- Painel administrativo para textos dos cards, separado das fórmulas.
- Preview, homologação, monitoramento e rollback.

## 6. Escopo excluído ou adiado

- Reescrita simultânea do backend e frontend.
- Alteração silenciosa da fórmula de qualquer KPI.
- Exposição pública do Excel original ou de dados pessoais.
- Classificação semântica por palavra isolada ou regex simples.
- KPI sem fonte suficiente apresentado como zero.
- Afirmação causal ou sazonal sem evidência.
- Migração cega de todo o histórico e de todas as branches do repositório antigo.
- Migração automática do módulo alheio `apps/motor-cad`.
- Implementação dos KPI 06 a 10 antes da definição de fontes e regras faltantes.

## 7. Invariantes dos dados

- A base oficial permanece preservada em seu formato autorizado.
- A camada pública usa apenas campos sanitizados e necessários.
- O frontend não reclassifica protocolos nem recalcula semântica.
- Dados originais, normalizados, semânticos, métricas e apresentação permanecem separados.
- Toda atualização registra origem, versão, data de corte, contagem, hash e regra semântica.
- Falha de atualização não substitui a última versão válida.
- Ausência de dado é exibida como indisponibilidade, nunca convertida automaticamente em zero.

Arquitetura lógica:

```text
RAW PRIVADO
  ↓
NORMALIZAÇÃO
  ↓
SEMÂNTICA VERSIONADA
  ↓
MÉTRICAS VERSIONADAS
  ↓
API
  ↓
REACT
  +
CAMADA EDITORIAL ADMINISTRÁVEL
```

## 8. Modelo de conclusão

Não haverá uma única coluna ambígua `DataConclusaoReal`. Devem ser preservados:

- `DataEncerramentoFormal`;
- `DataConclusaoOperacional`;
- `FonteConclusaoOperacional`;
- `ConfiancaConclusao`;
- `VersaoRegraConclusao`;
- `RevisaoHumana`;
- `DataConclusaoReferenciaKPI`;
- `FonteDataReferenciaKPI`.

A data formal pode ser adotada como proxy para determinado KPI somente por política explícita e rastreável.

## 9. Indicadores

- KPI 01: protocolos distintos abertos no período.
- KPI 02: conclusões no período, com conclusão operacional e encerramento formal preservados separadamente.
- KPI 03: estoque em uma data de referência, condicionado à política de saída aprovada.
- KPI 04: tempo dos processos concluídos; mediana recomendada como leitura principal e média, P90 e N como apoio, sujeito a aprovação.
- KPI 05: processos parados acima de X dias, com universo interno elegível e X parametrizado.
- KPI 06: depende de matriz oficial de prazos e suspensões.
- KPI 07: depende de histórico de eventos que permita distinguir diligência de trâmite.
- KPI 08: depende de fonte específica de fiscalizações.
- KPI 09: depende da definição de denúncia recebida e respondida.
- KPI 10: depende da base separada de projetos públicos.
- KPI 11: pendências por responsável/setor, preservando as distinções atuais.

## 10. Critério de entrega

Uma versão 80% utilizável deve ser entregue quando o núcleo estiver comprovado e restarem apenas melhorias marginais. Essa regra não ultrapassa hard gates de integridade, privacidade, semântica, autorização, rastreabilidade ou rollback.

## 11. Dados ainda necessários

- Excel oficial atual, aba, esquema e responsável.
- Confirmação sobre disponibilidade do histórico completo de trâmites.
- Artefatos originais do checkpoint G2 ou autorização para reprodução integral.
- Política gerencial do KPI 02 e da saída do estoque.
- Definições e fontes dos KPI 06 a 10.
- Usuários, autenticação, aprovação e persistência do painel administrativo.
- Arquivo oficial do logotipo e eventual manual de identidade visual.
