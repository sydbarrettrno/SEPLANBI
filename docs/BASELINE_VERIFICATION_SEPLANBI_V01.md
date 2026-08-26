# BASELINE VERIFICATION SEPLANBI V01

## Resultado

- Checkpoint: B0 — baseline funcional.
- Decisão: APROVAR.
- Níveis de validação: procedência, hash, automatizada, API e visual em navegador.
- Aprovação humana dos KPI: não realizada neste checkpoint.

## Testes automatizados

- `scripts/validate.py`: aprovado.
- `python -m unittest discover -s tests -v`: 13 testes aprovados.
- Cobertura observada: auditoria, métricas, filtros, paginação, privacidade, reconciliação e separação entre conclusão operacional e formal.

## Defeito encontrado e corrigido

O servidor local importava `backend.core`, enquanto produção, API e validação importavam `backend.final_entry`.

Antes da correção, a tela local mostrava, entre outros:

- concluídos: 1.876;
- estoque: 2.871;
- fila interna acima de 30 dias: 74,0%.

A produção e a validação final mostravam:

- concluídos: 2.181;
- estoque: 2.208;
- fila interna acima de 30 dias: 70,3%.

Após alterar uma importação em `scripts/dev.py`, testes e interface local passaram a coincidir com a produção.

## Paridade API

Foram comparados local e produção, com o mesmo período e parâmetros, em 19 verificações. Divergências: zero.

Itens comparados:

- status e data da fonte;
- linhas e protocolos únicos;
- taxonomia;
- recebidos;
- concluídos operacionais e formais;
- estoque;
- fila interna, espera externa e suspensos;
- mediana, média e P90;
- processos parados e percentual;
- total e tamanho da página de registros.

## Verificação visual

- Página inicial local carregou com conteúdo e sem erros de console.
- Valores centrais coincidiram com a produção.
- Oito rotas renderizaram conteúdo:
  - Visão Geral;
  - Protocolos;
  - Análises;
  - Indicadores;
  - Relatórios;
  - Unidades;
  - Responsáveis;
  - Configurações.
- A rota Protocolos exibiu 100 linhas e reconheceu o total de 6.975 registros.
- O primeiro registro visível foi carregado com protocolo, datas, categoria, status e tempo.
- O servidor local foi encerrado após a verificação.

## Tentativas e limitações

- O CLI `agent-browser` não estava instalado; não foi instalada dependência.
- O navegador integrado foi usado como substituição.
- Duas tentativas de avaliação avançada falharam por APIs não suportadas (`networkidle` e `performance`).
- A estratégia mudou para título, texto visível, DOM, logs e captura, que passou.
- A produção precisou de aproximadamente cinco segundos para sair do estado de carregamento; depois carregou sem erro de console.

## Alegações não comprovadas

- O pipeline Excel atualizável ainda não foi corrigido nem testado.
- Os números não receberam homologação humana neste checkpoint.
- KPI 06 a 10 continuam sujeitos às limitações de fonte já registradas.
- React, painel administrativo e novo deployment não foram iniciados.

## Próximo hard gate

D0 — unificar o artefato produzido pelo importador com o artefato consumido pela API e comprovar Excel A → API A, Excel B → API B e falha segura.
