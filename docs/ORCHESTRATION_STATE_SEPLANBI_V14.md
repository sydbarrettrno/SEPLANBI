# ORCHESTRATION STATE SEPLANBI V14

## Estado obrigatório

- `objetivo`: construir, reconciliar e publicar os painéis BI de Recebidos, Saídas e Estoque sobre a camada analítica validada.
- `escopo_incluido`: filtros globais, cross-filter, drill-down/up, breadcrumb, limpeza, tooltips, tabela exata, exportação pública sanitizada, responsividade, estados de loading/erro/vazio, testes, screenshots e publicação Vercel.
- `escopo_excluido`: indicadores 4–11, nova classificação semântica, reconstrução histórica do estoque, autenticação de PII e publicação de planilhas privadas.
- `etapa_atual`: gate pré-publicação da Etapa 5.
- `prioridade_dominante`: equivalência entre visual, API e protocolos, sem exposição de dados pessoais.
- `status_da_entrega`: `VALIDADA_LOCALMENTE_APTA_A_PREVIEW`.
- `autorizacao_de_corte`: concedida explicitamente pelo usuário em 30/08/2026.
- `projeto_vercel_confirmado`: `anibalnisgo/seplanbi`, ID `prj_loKnGqz2d61q2qVGRCaWA0M2xwcS`.
- `dominio_de_producao_confirmado`: `https://seplanbi.vercel.app`.
- `projeto_preservado`: `seplan-bi-react` não será alterado; `seplan.vercel.app` não pertence ao contexto Vercel autenticado e não será tocado.
- `rollback_dados`: `outputs/20260830-etapa1/rollback_pre_v06v04/data/`.
- `rollback_deploy`: deployment de produção anterior `dpl_2Lgd6wpjbrRMzmvM4YMNQv6o7hJD`.
- `data_de_corte`: posição operacional em 28/08/2026; Projetos Públicos em 27/08/2026.

## Fluxo verificado

```text
V06/V04 privadas
  → atualização transacional e sanitização
  → data/metadata.json + data/final_chunks
  → backend/analytics.py
  → /api?action=analytics
  → React/BiPanel
  → filtros cruzados, gráficos e drill-down público
```

O frontend não lê XLSX, não reclassifica status/categoria e não calcula KPI de forma independente. Todos os gráficos consultam o contrato central `seplanbi-analytics-v1`.

## Números reconciliados

- Protocolos totais/únicos: 7.063 / 7.063; duplicidades: 0.
- Recebidos 01/01/2026–28/08/2026: 2.898.
- Recebidos 01/01/2025–28/08/2025: 2.825; diferença +73; variação +2,6%.
- Saídas: 2.293 = 961 Concluído + 1.332 Encerrado.
- Saldo do período: +605.
- Estoque atual: 2.158 = 1.544 Fila Interna + 583 Responsável Externo + 31 Paralisado.
- Fila interna: 1.478 Em Análise + 66 Finalização Interna.
- Estoque que depende da SEPLAN: 71,5%.
- Idade do estoque: 345 em 0–30; 233 em 31–60; 125 em 61–90; 357 em 91–180; 1.098 em 181+.

## Funcionalidade implementada

- Rotas preservando filtros: `#/received`, `#/outputs` e `#/stock`.
- Recebidos: comparação homóloga, mês → macroprocesso → categoria → protocolos.
- Saídas: recebidos × saídas, composição Concluído/Encerrado, categoria → tipo de saída → protocolos e saldo mensal interpretado.
- Estoque: responsabilidade, idade, foco inicial interno, dimensão macroprocesso/categoria/setor e categoria → status → protocolos.
- Tabela: contagem exata, ordenação, pesquisa, paginação, clique no protocolo e CSV público sanitizado.
- PII: colunas privadas omitidas e mensagem explícita de bloqueio; responsável individual permanece indisponível sem autenticação.

## Evidências

- 45 testes Python aprovados.
- 6 cenários Playwright/Chrome aprovados em 53,4 s.
- TypeScript aprovado.
- Build Vite aprovado: 35 módulos; JS 253,96 kB e CSS 36,02 kB antes de gzip.
- `scripts/validate.py`: `VALIDADO`.
- `scripts/check_data_privacy.py`: `PRIVACIDADE_E_MINIMIZACAO_APROVADAS`; 0 arquivo proibido rastreado.
- `git diff --check`: sem erro de conteúdo; somente avisos de normalização LF/CRLF.
- Screenshots desktop e 390 × 844 em `outputs/20260830-etapa3/screenshots/` (diretório ignorado pelo Git).
- Console/page errors: 0; falhas de rede materiais: 0; cancelamentos `ERR_ABORTED` esperados ao trocar filtros foram excluídos da contagem.

## Erro encontrado e correção

O primeiro teste visual revelou que `from/to` reduzia o estoque atual aos processos abertos no período, retornando 1.237 em vez de 2.158. A causa foi corrigida em `backend/analytics.py`: como a fonte é fotografia atual e não histórico de estados, datas delimitam somente eventos de Recebidos/Saídas. Um teste de regressão impede reconstrução silenciosa do estoque.

## Privacidade

- Artefato privado: `C:\Users\aniba\AppData\Local\SEPLANBI\private\BASE_PRIVADA_PROTOCOLOS_30082026_V02.json.gz`.
- Campos privados: `ResponsavelInterno`, `NomeRequerente`, `ResponsavelTecnico`, `PessoaResponsavelExterna`, `TipoPessoaResponsavel` e `ObservacaoUltimoTramite`.
- Rotas públicas que retornam esses campos: 0.
- Exibição segura no deployment público atual: `NÃO`.
- Exportação privada: negada; exportação pública limitada à allowlist.

## Gate focus

- `decisao`: `AVANCAR_PARA_PREVIEW`.
- `evidencia_suficiente`: sim, para UI/API/dados públicos e publicação do mesmo artefato validado.
- `hard_gates`: dados, equações, privacidade, autorização e rollback atendidos.
- `limitações_explicitas`: setor histórico ausente; responsável interno é PII e não é exibido; não há estoque histórico reconstruível.
- `desvios_de_escopo`: nenhum indicador 4–11 foi desenvolvido.
- `proxima_acao`: commit seletivo, Preview Vercel, smoke test, promoção do mesmo deployment e teste de produção.
