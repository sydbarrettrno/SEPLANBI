# ORCHESTRATION STATE SEPLANBI V13

## Estado obrigatório

- `objetivo`: criar a camada analítica central e reutilizável dos três primeiros indicadores, sem desenvolver o visual definitivo nem publicar.
- `escopo_incluido`: recebidos, saídas, saldo, estoque, filtros globais, hierarquias, agrupamento, drill-down público/privado, ordenação, pesquisa, paginação, exportação pública sanitizada, testes e números de controle.
- `escopo_excluido`: visual definitivo, reconstrução histórica do estoque, inferência de setor, nova classificação semântica, autenticação, publicação, commit, push e deploy.
- `etapa_atual`: checkpoint final da Etapa 2.
- `prioridade_dominante`: contrato analítico único com integridade matemática e privacidade.
- `acao_em_curso`: nenhuma; aguardar o próximo prompt.
- `status_da_entrega`: `CONCLUIDA_NO_ESCOPO_APROVADO`.
- `status_do_briefing`: `PRONTO_PARA_ORGANIZAR` e executado.
- `condicoes_de_parada`: parar após modelo, funções, hierarquias, filtros, testes e números; não publicar nem construir o visual final.
- `dependencias`: autenticação/autorização futura para PII; fonte futura com setor histórico se essa dimensão precisar ser completa em recebidos/saídas.
- `responsavel_atual`: usuário, para definir a próxima etapa.
- `autorizacoes_e_limites`: mutações locais no repositório e camada privada externa; sem Git remoto/Vercel.
- `baseline_preservado`: Etapa 1 V12 e rollback `outputs/20260830-etapa1/rollback_pre_v06v04/data/`; artefato privado V01 preservado.
- `criterio_de_conclusao`: três equações fechadas; categoria selecionada retorna protocolos exatos; contrato/API central; drill-down e export público sanitizados; PII sem rota; build e testes aprovados.
- `evidencia_esperada`: suíte real, validadores, typecheck/build, API HTTP local, ACL privada e diff sem erros.
- `versao`: V13.
- `data_de_corte`: dados operacionais em 28/08/2026; checkpoint em 30/08/2026.

## Modelo analítico

- Contrato: `seplanbi-analytics-v1`.
- Implementação: `backend/analytics.py`.
- API: `/api?action=analytics`.
- Exportação pública: `/api?action=analytics-export`.
- Dataset: transporte público compacto v9 em `data/metadata.json` + `data/final_chunks/`.
- Fluxo: dataset canônico → enriquecimento → filtros → universo → agrupamento/totais/drill-down → API → React.
- O dashboard legado reutiliza `indicator_rows`, `apply_filters` e o dataset enriquecido; os componentes não recalculam a semântica.

## Números de controle

- Recebidos 01/01/2026–28/08/2026: 2.898.
- Recebidos 01/01/2025–28/08/2025: 2.825; variação +2,6%.
- Saídas: 2.293 = 961 Concluído + 1.332 Encerrado.
- Saldo: +605.
- Estoque: 2.158 = 1.544 interno + 583 externo + 31 paralisado.
- Estoque interno: 1.478 Em Análise + 66 Finalização Interna.
- Idade: 345 em 0–30; 233 em 31–60; 125 em 61–90; 357 em 91–180; 1.098 em 181+.
- Duplicidades: 0; protocolos únicos: 7.063.

## Privacidade e disponibilidade de campos

- `SetorAtual`: público e institucional; completo nos 2.158 registros da aba de estoque.
- Setor histórico em recebidos/saídas: não fornecido pela V04/V06; registrado como `Não informado na fonte`, sem inferência.
- `ResponsavelInterno`: adicionado somente ao artefato privado V02.
- Artefato privado V02: `C:\Users\aniba\AppData\Local\SEPLANBI\private\BASE_PRIVADA_PROTOCOLOS_30082026_V02.json.gz`.
- ACL V02: somente `ANIBAL\anibal` com controle total herdado.
- Rotas públicas que carregam PII: 0.
- Exportação pública: somente allowlist sanitizada.
- Exportação privada: negada.
- Exibição segura de PII no deployment atual: `NÃO`.

## Evidências obtidas

- 41 testes Python aprovados.
- `scripts/validate.py`: aprovado.
- `scripts/check_data_privacy.py`: aprovado; 7.063 linhas, 396 eventos, 20 projetos, 0 arquivo privado rastreado.
- TypeScript: aprovado pelo binário local explícito.
- Build Vite: aprovado; 32 módulos.
- API HTTP local: analytics recebeu 2.898, soma agrupada 2.898, homólogo 2.825, PII negada; estoque 2.158 em três grupos, equação verdadeira.
- Aplicação transacional v9: checksum e unicidade aprovados; tentativa inicial v9 foi bloqueada pelo validador v8 e não substituiu a carga anterior; validador corrigido para aceitar v8/v9 sem relaxar os gates.
- Git remoto e deploy: não executados.

## Hierarquias e filtros

- Recebidos: Ano → Mês → Macroprocesso → Categoria → Protocolos.
- Saídas: Ano → Mês → Macroprocesso → Categoria → Tipo de saída → Protocolos.
- Estoque: Responsabilidade → Macroprocesso → Categoria → Status → Protocolos.
- Filtros: período, ano, mês, macroprocesso, categoria, status, setor, responsabilidade, tipo de saída e pesquisa.
- Resposta: filtros ativos, `Limpar filtros`, breadcrumb, grupos, totais e drill-down paginado/ordenável.

## Histórico de tentativas

1. `apply-schema-v9`: troca transacional bloqueada porque o validador comum aceitava somente v8; carga anterior preservada; corrigido para validar v8/v9, mantendo checksum, contagem e unicidade.
2. `analytics-search`: teste detectou protocolo numérico tratado como substring; corrigido para correspondência exata e suíte integral aprovada.
3. `browser-agent-local`: pacote ausente; execução temporária via npm não criou sessão utilizável no Windows; após duas abordagens, verificação visual foi encerrada e substituída por build, typecheck e HTTP local.

## Arquivos alterados nesta etapa

- `backend/analytics.py`;
- `backend/core.py`;
- `backend/delivery_core.py`;
- `backend/delivery_v07.py`;
- `backend/private_data.py`;
- `api/index.py`;
- `scripts/atualizar_bases_validadas.py`;
- `scripts/importar_excel.py`;
- `scripts/check_data_privacy.py`;
- `scripts/dev.py`;
- `data/metadata.json`;
- `data/final_chunks/part-000` a `part-016`;
- `src/analytics.ts`;
- `src/api.ts`;
- `src/App.tsx`;
- `src/components/FilterBar.tsx`;
- `src/styles.css`;
- `src/types.ts`;
- `tests/test_analytics.py`;
- `tests/test_core.py`;
- `docs/ANALYTICAL_MODEL_SEPLANBI_V01.md`;
- `docs/ORCHESTRATION_STATE_SEPLANBI_V13.md`.

## Limitações e próxima ação

- `riscos_residuais`: ausência de setor histórico; responsável interno preenchido somente em 464 linhas da aba de estoque; UI visual definitiva ainda não construída; browser automático indisponível neste checkpoint; alterações locais não versionadas.
- `validacoes_pendentes`: revisão humana do contrato analítico; autenticação/autorização antes de qualquer PII; inspeção visual ficará para a etapa do painel.
- `proxima_acao`: nenhuma automática. Parar e aguardar o próximo prompt.
- `backlog`: visual final; interação gráfica completa; autenticação por perfil; auditoria de acesso; eventual fonte histórica de setor.

## Gate focus

- `decisao`: `CONCLUIR`.
- `progresso_material`: contrato central implementado, integrado e comprovado com dados reais.
- `nivel_de_validacao`: estrutural, automatizada, matemática, privacidade, build e HTTP local.
- `independencia_da_revisao`: autorrevisão; sem revisor humano independente.
- `alegacoes_nao_comprovadas`: validação visual em navegador e homologação administrativa.
- `desvios`: nenhum desenvolvimento de painel definitivo ou publicação.
- `pendencias_essenciais`: nenhuma para a camada analítica local; autenticação continua hard gate para PII.
- `correcao_ou_proxima_acao`: parar.
