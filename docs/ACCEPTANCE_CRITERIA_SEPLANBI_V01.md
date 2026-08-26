# ACCEPTANCE CRITERIA SEPLANBI V01

## 1. S0 — orquestra e escopo

- [ ] As quatro skills existem em caminhos descobríveis.
- [x] Os quatro `SKILL.md` atendem estruturalmente aos invariantes do validador.
- [ ] Casos positivo, negativo, ambíguo e combinado foram avaliados independentemente.
- [ ] Sobreposições ou conflitos materiais foram corrigidos.
- [x] Charter, estado, decisões e critérios existem localmente em V01.
- [ ] Os quatro documentos foram auditados contra o estado real.
- [ ] O checkpoint foi apresentado e aprovado pelo usuário.

## 2. B0 — baseline

- [ ] A origem, commit, data e caminhos importados estão registrados.
- [ ] O módulo alheio `apps/motor-cad` não foi importado sem decisão explícita.
- [ ] Os hashes dos ativos críticos correspondem ao baseline escolhido.
- [ ] Testes Python existentes passam no novo repositório.
- [ ] API local e produção coincidem nos indicadores essenciais.
- [ ] Telas, rotas, filtros e drill-down atuais estão inventariados.
- [ ] Nenhuma alteração foi feita na produção.
- [ ] Existe tag local/remota de baseline após aprovação de publicação.

## 3. D0 — atualização dos dados

- [ ] Existe um único artefato final canônico consumido pela API.
- [ ] Um Excel válido novo altera hash, versão e resposta da API.
- [ ] Um Excel inválido não substitui a última versão válida.
- [ ] Linhas, protocolos únicos, esquema e datas são reconciliados.
- [ ] Campos públicos passam por allowlist e teste de privacidade.
- [ ] Original privado, normalizado, semântico e público estão separados.
- [ ] Há rollback de dataset documentado e testado.

## 4. K0 — semântica, KPI e API

- [ ] Conclusão operacional e encerramento formal estão separados.
- [ ] O anexo G2 foi reproduzido ou substituído por auditoria equivalente.
- [ ] Existe conjunto ouro humano com contraexemplos.
- [ ] Casos indeterminados permanecem explícitos.
- [ ] Cada KPI registra universo, fórmula, datas, exclusões, nulos e limitações.
- [ ] KPI 02, 03 e 04 fecham matemática e semanticamente.
- [ ] O contrato da API está versionado.
- [ ] O frontend não precisa recalcular semântica.

## 5. R0 — React com paridade

- [ ] React + Vite + TypeScript executam no ambiente definido.
- [ ] Rotas, filtros, cards, gráficos, tabela, paginação e drill-down essenciais existem.
- [ ] Os mesmos filtros retornam os mesmos protocolos do baseline.
- [ ] Valores dos KPI coincidem com a API aprovada.
- [ ] Estados de carregamento, erro, vazio e indisponibilidade estão explícitos.
- [ ] Não há erros materiais no console ou rede.

## 6. U0 — comunicação visual

- [ ] A primeira tela apresenta no máximo cinco sinais predominantes.
- [ ] Demanda, produção, saldo, estoque, tempo e gargalo formam narrativa coerente.
- [ ] Cores representam condição operacional e não implicam positividade indevida.
- [ ] Cor não é o único meio de comunicar estado.
- [ ] Tendência mensal está visível.
- [ ] Sazonalidade só é afirmada com histórico suficiente.
- [ ] Os onze indicadores permanecem disponíveis nos painéis de detalhe.
- [ ] O drill-down chega ao conjunto exato de protocolos.
- [ ] Layout foi verificado em notebook, tablet e celular.

## 7. A0 — administração

- [ ] Usuários e autenticação foram definidos.
- [ ] Textos administráveis estão separados do contrato dos KPI.
- [ ] Rascunho, preview, publicação, histórico e rollback funcionam.
- [ ] O administrador não pode alterar fórmula ou valor do indicador.
- [ ] A área de escrita não está exposta publicamente.

## 8. H0 — homologação

- [ ] Testes automatizados relevantes passam.
- [ ] Navegador → API → dataset → resposta → tela foi verificado.
- [ ] Filtros, deep links, drill-down e exportação foram testados.
- [ ] Privacidade foi revalidada.
- [ ] Os KPI receberam validação humana necessária.
- [ ] O preview está separado da produção.
- [ ] Existe plano de rollback.

## 9. P0 — produção

- [ ] Versões de fonte, dataset, regra, KPI, API, frontend e textos foram congeladas.
- [ ] Deployment anterior está registrado e recuperável.
- [ ] Corte foi explicitamente autorizado.
- [ ] Smoke test e verificação integral passaram em produção.
- [ ] Uma atualização real pelo Excel foi comprovada após o corte.
- [ ] O repositório novo é a fonte rastreável da produção.
- [ ] Legado só foi removido após estabilização.

## 10. Regra de conclusão

Hard gates de dados, privacidade, semântica, autorização e rollback são obrigatórios. Após esses gates, melhorias marginais não impedem a entrega de uma versão 80% utilizável; elas devem ser registradas no backlog.
