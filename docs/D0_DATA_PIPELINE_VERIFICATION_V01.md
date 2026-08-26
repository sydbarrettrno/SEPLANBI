# D0 — verificação do pipeline seguro de dados V01

## 1. Objetivo e escopo

Corrigir o caminho `Excel externo → artefato canônico → API` sem alterar o frontend, o repositório remoto, a Vercel ou a produção. A classificação semântica V07 existente deve permanecer fixa por protocolo e a base versionável deve conter somente campos necessários ao painel.

## 2. Entradas verificadas

| Papel | Arquivo externo | SHA-256 | Resultado |
|---|---|---|---|
| Fonte operacional bruta | `BASE2326ETL.xlsx` | `5b8dd9021bbf71c97e01aa21bdcd9ae90baa96bfe21688119acb777ef3f9c586` | 14.943 protocolos de 2023–2026; 6.975 no escopo 2025+ |
| Memória semântica vigente | `SEPLAN_AUDITORIA_CLASSIFICACAO_STATUS_V01.xlsx`, aba `STATUS_COMPLETO` | `b2329c30f2fd49d5b251b7f14651fd68c2b584a903b4973221543436c0e18268` | 6.975 chaves; categoria V07 e status coincidem 100% com a carga publicada |
| Evidência histórica, não canônica | `SEPLAN_Base_Original_StatusReal_V05_Classificada.xlsx` | `9478d4b9b172ea5295d74eda30565b7660d1e4d8fb235e50c96993e02cd7c07a` | 6.957 registros; anterior à V07 e não usada para regredir a classificação |

Os três Excel permaneceram fora de `C:\SEPLANBI` e não foram adicionados ao Git.

## 3. Reconciliação

- Protocolos 2025: 4.165.
- Protocolos 2026: 2.810.
- Total e chaves únicas: 6.975.
- Chaves da fonte bruta versus `STATUS_COMPLETO`: 6.975 em comum; zero ausentes.
- Datas de abertura, último trâmite e encerramento formal versus baseline: 100% idênticas.
- Categoria V07 versus baseline: 100% idêntica.
- Status Real versus baseline: 100% idêntico.
- Data de conclusão operacional versus regra publicada: 100% idêntica.
- Corte da fonte: 22/08/2026.

## 4. Regra de preservação semântica

- Categoria e macroprocesso existentes são imutáveis por protocolo no fluxo automático.
- Status existente é preservado enquanto a impressão digital operacional não muda.
- Protocolo novo ou alteração operacional exige registro correspondente na aba semântica auditada.
- Alteração de categoria existente é bloqueada, mesmo quando aparece em nova planilha, até existir um procedimento explícito de override versionado.
- Não há classificação por palavra isolada, fallback textual ou publicação automática de casos desconhecidos.

## 5. Minimização e segurança

O artefato público canônico possui somente nove vetores compactos:

- número e ano do protocolo;
- abertura;
- último trâmite;
- encerramento formal;
- macroprocesso;
- categoria;
- status operacional;
- impressão digital não reversível da origem para detectar mudanças.

Nomes, CPF/CNPJ, observações livres, responsáveis nominais e campos auxiliares do ETL não entram no artefato. O gate `scripts/check_data_privacy.py` bloqueia extensões privadas rastreadas, schema diferente da allowlist e padrões de e-mail/CPF/CNPJ/telefone nos dicionários públicos.

Limitação: a base é minimizada, não anonimizada. Número de protocolo, datas e categorias podem permitir correlação indireta com outros sistemas. Restringir o drill-down exige decisão administrativa e futura autenticação; tornar o Git privado reduz exposição, mas não substitui controle de acesso do site/API.

## 6. Fluxo implementado

1. `scripts/ATUALIZAR_DASHBOARD.bat` recebe caminhos externos.
2. O importador executa em `CONFERENCIA`, sem escrita.
3. Gates de chave, cronologia, memória semântica e privacidade bloqueiam inconsistências.
4. O artefato candidato é gerado deterministicamente em memória.
5. Com `--apply`, chunks e manifesto são gravados em staging, revalidados e substituídos de forma transacional.
6. O backend lê somente `metadata.artifact → data/final_chunks`.
7. O script executa privacidade, indicadores e testes.
8. Nenhum `git add`, commit, push ou deploy é executado pelo atualizador.

Foram removidos o transporte duplicado `data/safe_chunks` e os 632 overrides de `backend/taxonomy_v07.py`, pois a V07 já está incorporada no artefato canônico.

## 7. Evidências de validação

- Atualizador completo: cinco etapas aprovadas.
- Privacidade/minimização: `PRIVACIDADE_E_MINIMIZACAO_APROVADAS`.
- Testes: 19/19 aprovados.
- Determinismo: mesmas entradas produzem o mesmo SHA-256 do GZIP.
- SHA-256 do artefato v8: `d7e5b1ac69105e54e9e736517d6200e17aa1c26e2e6f92796fcf87f337456824`.
- Indicadores: idênticos ao baseline de 6.975 protocolos.
- Entrada inválida: bloqueada; hashes do manifesto e dos chunks permaneceram inalterados.
- Busca por protocolo: compatibilidade corrigida e teste aprovado.
- Produção, Vercel, Git remoto e repositório antigo: não alterados.

## 8. Indicadores preservados

| Controle | Valor |
|---|---:|
| Recebidos no período padrão | 2.810 |
| Concluídos operacionalmente | 2.181 |
| Encerrados formalmente | 1.876 |
| Estoque | 2.208 |
| Fila interna | 1.548 |
| Espera externa | 627 |
| Suspensos | 33 |
| Parados acima de 30 dias na fila interna | 1.089 |
| Mediana de tramitação | 54 dias |
| P90 de tramitação | 229 dias |

## 9. Estado de aceite

`D0 ENTREGUE PARA A BASE ATUAL, COM RESSALVAS NÃO BLOQUEANTES`.

Ressalvas para a próxima extração:

1. comprovar com um delta oficial real o fluxo de novos/alterados;
2. executar uma injeção de falha durante a troca transacional para testar rollback de processo interrompido;
3. decidir se o drill-down continuará público ou será autenticado.

Essas ressalvas não impedem o uso do script para preparar e validar a base atual antes de qualquer atualização no Git.
