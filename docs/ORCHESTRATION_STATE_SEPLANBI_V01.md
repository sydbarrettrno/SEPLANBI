# ORCHESTRATION STATE SEPLANBI V01

## 1. Estado geral

- Data de corte: 26/08/2026
- Etapa global: 2 de 9
- Checkpoint: S0 — recuperação da orquestra e congelamento do escopo
- Estado: EM EXECUÇÃO
- Prioridade dominante: validar as quatro skills e consolidar o contrato do projeto
- Próxima etapa proibida neste momento: migração do código publicado e início do React

## 2. Acompanhamento de consumo

- Meta de execução ativa no thread: `01a03c56-e20e-7e63-a8f6-30c5948fdc38`
- Orçamento numérico de tokens: NÃO DEFINIDO PELO USUÁRIO
- Contagem de tokens restantes pela meta: INDISPONÍVEL SEM ORÇAMENTO
- Captura fornecida pelo usuário em 26/08/2026:
  - janela de 5 horas: 89% restante; interface exibiu 07:40;
  - janela semanal: 77% restante; renovação indicada em 1 de setembro.
- Regra: registrar consumo observado a cada checkpoint e não confundir percentual de cota com número exato de tokens.

## 3. Repositórios e ambientes

### Destino

- Remoto: `https://github.com/sydbarrettrno/SEPLANBI.git`
- Local: `C:\SEPLANBI`
- Situação inicial confirmada: remoto vazio e diretório local vazio.
- Situação atual: clone local criado; nenhum commit; nenhum push.

### Fonte publicada

- Repositório: `https://github.com/sydbarrettrno/seplanitapoa`
- Commit: `24e1be66207d44c1085765ccb65105b9b890535c`
- Produção: `https://seplan-bi-react.vercel.app/`
- Produção e repositório antigo: NÃO ALTERADOS.

## 4. Skills canônicas recriadas

| Skill | Caminho | SHA-256 | Estado |
|---|---|---|---|
| organizer | `C:\Users\aniba\.codex\skills\organizer\SKILL.md` | `D84B7B4CED1224B46DEA0CED31C44A594D70077EAE582A6B160219C3D3CD3131` | validação estrutural alternativa aprovada; teste independente em andamento |
| execute | `C:\Users\aniba\.codex\skills\execute\SKILL.md` | `C4AF35152301A1BAE56F327CC04DD145A724C6A8CA424A4473160807B344AD21` | validação estrutural alternativa aprovada; teste independente em andamento |
| focus | `C:\Users\aniba\.codex\skills\focus\SKILL.md` | `D356980C0F1D4F3DDBA64E3C0BE5DA9AB990EFBC33FBE0099C43556B7B075E41` | validação estrutural alternativa aprovada; teste independente em andamento |
| estruturar-pedido-vago | `C:\Users\aniba\.codex\skills\estruturar-pedido-vago\SKILL.md` | `F2A7A512617725BAC423C52D897B18F1966635C4532630FCF465C07B7615D4CE` | validação estrutural alternativa aprovada; teste independente em andamento |

O validador oficial `quick_validate.py` não executou porque os dois runtimes Python disponíveis não continham PyYAML. Não foi instalada dependência. Os invariantes do validador foram lidos e reproduzidos por verificação alternativa: existência, frontmatter, chaves aceitas, nome em hyphen-case, limite de tamanho, descrição e ausência de TODO.

Tentativas registradas:

- `S0-T01`: Python padrão — falhou antes da validação por ausência de `yaml`.
- `S0-T02`: Python do runtime do workspace — mesma falha.
- Decisão Focus: não repetir uma terceira tentativa equivalente; mudar a estratégia.
- `S0-T03`: verificação alternativa teve erro sintático de interpolação antes de ler os arquivos.
- `S0-T04`: erro sintático corrigido; quatro skills aprovadas estruturalmente.

## 5. Papéis da orquestra

- `estruturar-pedido-vago`: atua somente quando uma ambiguidade material impedir planejamento seguro e encerra antes da execução.
- `organizer`: mantém prioridade, sequência, dependências, gates e estado de continuidade; não substitui o executor.
- `execute`: implementa uma unidade delimitada e produz evidências.
- `focus`: audita independentemente e decide continuar, corrigir, mudar abordagem, reduzir, solicitar dado, pausar ou concluir.

## 6. Fatos técnicos que não podem ser esquecidos

1. O frontend publicado atual é HTML/CSS/JavaScript nativo, não React.
2. A API publicada usa Python.
3. O atualizador documentado escreve `data/safe_chunks`, mas a API consome `data/final_chunks` e metadados rígidos em `backend/final_data.py`.
4. React não pode começar antes da reconciliação do pipeline e do contrato dos indicadores.
5. O anexo G2 contém hipóteses relevantes, mas os quatro artefatos citados não foram anexados.
6. `DataEncerramentoFormal` e `DataConclusaoOperacional` não podem ser fundidas silenciosamente.
7. O módulo `apps/motor-cad` não deve ser importado automaticamente para o novo repositório.
8. A produção atual deve permanecer como rollback até homologação e corte controlado.

## 7. Arquivos produzidos neste checkpoint

- `docs/PROJECT_CHARTER_SEPLANBI_V01.md`
- `docs/ORCHESTRATION_STATE_SEPLANBI_V01.md`
- `docs/DECISION_LOG_SEPLANBI_V01.md`
- `docs/ACCEPTANCE_CRITERIA_SEPLANBI_V01.md`

Estado dos arquivos: LOCAIS, NÃO COMMITADOS, NÃO ENVIADOS.

## 8. Bloqueios do checkpoint S0

- Aguardando parecer do teste comportamental independente das quatro skills.
- Charter e critérios ainda precisam de auditoria interna antes de commit.
- Dados administrativos e KPI 06 a 10 permanecem pendentes, mas não impedem a formação do baseline.

## 9. Próximas ações autorizadas

1. Receber o teste independente.
2. Corrigir apenas problemas materiais das skills.
3. Recalcular hashes se houver correção.
4. Revisar os quatro documentos do checkpoint.
5. Executar `git diff --check` e conferir o status.
6. Submeter o checkpoint S0 ao usuário antes da migração do baseline.

## 10. Instruções para continuidade por outro modelo

Ao assumir esta execução:

1. leia integralmente os quatro documentos em `C:\SEPLANBI\docs`;
2. leia as quatro skills canônicas nos caminhos registrados acima;
3. confira `git status` antes de editar;
4. obtenha o estado da meta e registre o consumo;
5. não inicie React, importação de Excel, push ou Vercel enquanto S0 não estiver aprovado;
6. preserve o repositório antigo e a produção;
7. use uma prioridade dominante por checkpoint;
8. após duas tentativas equivalentes sem progresso, mude a estratégia;
9. diferencie testes técnicos de aprovação humana;
10. atualize este estado em versão sequencial, preservando a versão anterior.
