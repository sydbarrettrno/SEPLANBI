# Estado de Orquestra — SEPLANBI V24

Data: 05/09/2026
Data de corte dos alvarás: 03/09/2026

## Estado obrigatório

- `objetivo`: reorganizar a aba pública `#/construction` para apresentação à Chefia de Gabinete, preservando a base e os indicadores já publicados.
- `escopo_incluido`: hierarquia e legibilidade da aba; separação entre visão executiva e consulta; destaque do período equivalente de 2026; alternância do gráfico histórico; composição inicialmente limitada aos cinco anos completos mais recentes; consulta pública com 25 linhas por página; correção do rótulo público de uso residencial; suporte da API de alvarás no servidor local; testes correspondentes.
- `escopo_excluido`: alteração de fórmulas, reclassificação da base, novo KPI, mudança da planilha-fonte, exposição de campos privados, commit, push, preview, deploy ou promoção para produção.
- `etapa_atual`: checkpoint local concluído.
- `prioridade_dominante`: leitura executiva em poucos segundos sem perder a consulta rastreável.
- `acao_em_curso`: entrega do estado local para conferência do usuário.
- `status_da_entrega`: `ENTREGA_UTILIZAVEL_COM_BACKLOG`.
- `status_do_briefing`: `PRONTO_PARA_ORGANIZAR` e executado no escopo solicitado.
- `condicoes_de_parada`: não publicar, não alterar a planilha-fonte e não mudar cálculo ou classificação sem nova autorização.
- `dependencias`: planilha `C:\Users\aniba\Downloads\Alvaras_Itapoa_Analitico.xlsm`; artefato público minimizado em `data/construction_permits_public.xz.b64.part*`; API `construction-data` e `construction-export`.
- `responsavel_atual`: usuário para conferência e decisão de publicação.
- `autorizacoes_e_limites`: alteração local autorizada; publicação não autorizada.
- `baseline_preservado`: `origin/main` e `HEAD` em `79666a09d4f2e7d86a5d8a66d3a7bcdcf00390ff` antes das mudanças locais; documentos não rastreados preexistentes preservados.
- `criterio_de_conclusao`: visão executiva prioriza 2026 e não carrega a tabela; consulta mantém filtros, exportação e paginação; números reconciliam com a planilha; nenhuma rolagem horizontal global em 390 px; build, TypeScript, privacidade e testes da aba aprovados; interface inspecionada no navegador.
- `evidencia_esperada`: correspondência dos totais, troca funcional de modos, filtros reconciliados, ausência de campos privados, legibilidade em desktop e celular e ausência de erros no navegador.
- `evidencias_obtidas`: planilha com 9.912 registros; 9.139 alvarás em 2016–2025; 4.777 construções novas; 1.149.029,94 m²; mediana 106,4 m²; comparação 2025/2026 de 661/773 alvarás, 258/328 construções novas e 88.900,58/155.708,82 m²; filtro público residencial com 6.133 registros; console do navegador sem erros ou avisos.
- `decisoes`: separar apresentação e consulta na mesma rota; exibir primeiro o período equivalente de 2026; manter 2016–2025 como referência histórica; apresentar composição de 2021–2025 por padrão com acesso à série completa; preservar `RESIDENCIAL` como `Residencial — não especificado`.
- `bloqueios`: nenhum para entrega local; publicação bloqueada por ausência de autorização explícita.
- `arquivos_alterados`: `backend/construction_data.py`; `scripts/dev.py`; `src/components/ConstructionPermitsPanel.tsx`; `src/construction-base.css`; `src/construction-dashboard.css`; `src/construction-interaction.css`; `tests/bi-functional.spec.ts`; `tests/test_construction_data.py`; este documento.
- `artefatos_preservados`: planilha-fonte, dados agregados em `src/construction.ts`, partes públicas compactadas, backend e rotas de produção existentes, documentos de controle não rastreados do usuário.
- `historico_tentativas`: T01 — os comandos `npm run` não localizaram os executáveis locais no `PATH`; abordagem substituída pela execução direta das dependências já instaladas; T02 — `pytest` não estava instalado; os dois testes novos foram executados diretamente pelo runtime Python sem instalar pacote global; T03 — o primeiro E2E reutilizou servidor local antigo sem as novas rotas; o processo foi identificado pela porta e reiniciado com o código atual.
- `validacoes_pendentes`: conferência humana da Chefia de Gabinete; preview e produção somente após autorização.
- `riscos_residuais`: a base publicada é um snapshot minimizado derivado da planilha, não uma conexão ao vivo com Downloads; protocolo e datas permanecem identificadores indiretos no recorte público; a atualização futura da planilha ainda depende do fluxo de geração e publicação do artefato.
- `proxima_acao`: usuário conferir a versão local e decidir se autoriza commit e preview.
- `backlog`: automatizar a atualização rastreável da base de alvarás, se solicitado; registrar teste de atualização com nova extração; avaliar texto final com a Chefia de Gabinete.
- `versao`: V24.
- `data_de_corte`: 05/09/2026.

## Evidências técnicas

- SHA-256 da planilha-fonte: `4B22A41FDF6A01870141CE4AED67E10E6A09B43E3B8E3044DE2DB366395B44B8`.
- TypeScript: aprovado.
- Build React/Vite: aprovado, 61 módulos transformados.
- Testes funcionais completos: 10 de 10 aprovados antes do último ajuste responsivo localizado.
- Testes funcionais da Construção Civil após o ajuste final: 2 de 2 aprovados.
- Testes da base pública de alvarás: 2 de 2 aprovados.
- Verificação de privacidade e minimização: aprovada.
- Validação visual: desktop 1440 × 1000 e celular 390 × 844 aprovados para os modos executivo e consulta.
- Console do navegador: sem erros ou avisos no fluxo validado.

## Gate `focus`

- `decisao`: `CONCLUIR`.
- `progresso_material`: a aba deixou de misturar apresentação e tabela extensa na mesma leitura; o cenário atual passou a ser o primeiro bloco decisório; a consulta permaneceu disponível e filtrável.
- `criterio_e_versao_auditados`: V24 contra o objetivo de apresentação à Chefia de Gabinete e os hard gates do projeto.
- `evidencias_aceitas`: reconciliação da planilha, build, TypeScript, testes da base, E2E, privacidade, DOM, screenshots e console.
- `fontes_de_evidencia`: planilha-fonte local, código, API local, testes e interface renderizada.
- `alegacoes_nao_comprovadas`: aprovação humana da Chefia; comportamento em produção após as mudanças locais.
- `desvios`: nenhum desvio material de escopo identificado.
- `riscos`: snapshot não é atualização automática; microdados públicos minimizados ainda exigem controle contínuo de privacidade.
- `tentativas_consideradas`: T01, T02 e T03.
- `avaliacao_de_equivalencia`: não houve terceira repetição de tentativa equivalente; cada falha recebeu abordagem diferente.
- `nivel_de_validacao`: estrutural, automatizada e visual; não humana, administrativa ou de produção.
- `independencia_da_revisao`: autorrevisão baseada no estado real e em evidências renderizadas.
- `pendencias_essenciais`: nenhuma para a entrega local; autorização é essencial para publicar.
- `correcao_ou_proxima_acao`: entregar para conferência e aguardar autorização de commit/preview.
- `itens_para_backlog`: atualização automatizada da base e homologação com a Chefia.
