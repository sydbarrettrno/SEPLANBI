# ORCHESTRATION STATE SEPLANBI V03

## Estado

- Data de corte: 26/08/2026
- Etapa concluída: 3 de 9
- Checkpoint: B0 — baseline funcional
- Decisão Focus: `CONCLUIR`
- `status_da_entrega`: `CONCLUIDA_NO_ESCOPO_APROVADO`
- Próxima etapa: 4 de 9 — pipeline D0
- Servidor local: encerrado
- Abas de teste: encerradas
- GitHub/Vercel/produção: não alterados

## Consumo

- Meta S0 concluída: 44.412 tokens em 9 min 21 s.
- Meta B0, ponto intermediário: 99.110 tokens em 11 min 12 s.
- Orçamento numérico: não definido.
- Saldo exato: indisponível.
- Última captura de cota do usuário: 89% restante na janela de 5 horas e 77% semanal; essa captura é anterior ao B0 e pode estar desatualizada.

## Entregas B0

- 61 arquivos do dashboard migrados localmente.
- 19 arquivos de `apps/motor-cad` excluídos.
- Manifesto: `docs/BASELINE_PROVENANCE_SEPLANBI_V01.md`.
- Verificação: `docs/BASELINE_VERIFICATION_SEPLANBI_V01.md`.
- Correção local: `scripts/dev.py` usa `backend.final_entry`.
- Testes: validação própria + 13 testes aprovados.
- Paridade: 19 verificações de API, zero divergências.
- Navegação: oito rotas com conteúdo.
- Protocolos: 100 registros visíveis de 6.975.

## Evidências aceitas

- SHA do checkout de origem igual ao commit publicado.
- Hash arquivo a arquivo na cópia inicial.
- Somente uma diferença intencional após a correção local.
- Dataset sanitizado com 6.975 protocolos e taxonomia V07.
- Interface local e produção com os mesmos indicadores centrais.
- Ausência de erros de console nas telas verificadas.

## Riscos e pendências

1. O importador escreve o transporte legado e não está comprovado que atualize `final_chunks` e os metadados usados pela API.
2. Os testes atuais possuem valores fixos e podem passar sobre a carga anterior.
3. `safe_chunks` e `final_chunks` coexistem.
4. `backend/final_data.py` e `backend/taxonomy_v07.py` possuem baseline rígido/overrides.
5. Não existe autenticação ou persistência administrativa.
6. Não há React.
7. O G2 ainda precisa ser reproduzido com artefatos verificáveis.

## Próxima prioridade dominante — D0

Comprovar e corrigir a atualização ponta a ponta sem alterar a base oficial.

### Sequência recomendada

1. localizar o Excel oficial atual e confirmar aba/esquema;
2. mapear importador, manifesto, `safe_chunks`, `final_chunks`, `final_data` e taxonomia;
3. projetar um artefato final canônico e rollback;
4. preparar fixtures sanitizadas representativas, sem publicar a base privada;
5. testar que mudança de entrada altera o artefato e a API;
6. testar que entrada inválida preserva a versão anterior;
7. atualizar documentação e estado V04.

### Condições de parada

- Excel oficial ou esquema não identificados;
- necessidade de publicar dado privado;
- divergência que exija redefinição humana de KPI;
- mutação em produção/Vercel;
- duas abordagens diferentes sem avanço.

## Handoff para ChatGPT 5.6 Sol Raciocínio Avançado

1. Leia `AGENTS.md`.
2. Leia esta V03 e os dois relatórios B0.
3. Confira `git status`, commit/tag local e ausência de push.
4. Leia as skills `organizer`, `execute` e `focus` nos caminhos registrados na V02.
5. Consulte o monitor de consumo antes de abrir a meta D0.
6. Não inicie React: o próximo gate é exclusivamente o pipeline de dados.
7. Não use os números do anexo G2 como verdade sem reprodução.
8. Não exponha o Excel oficial no repositório público.
9. Ao concluir ou bloquear D0, crie `ORCHESTRATION_STATE_SEPLANBI_V04.md`.
