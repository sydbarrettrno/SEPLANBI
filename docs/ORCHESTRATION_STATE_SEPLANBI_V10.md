# ORCHESTRATION STATE SEPLANBI V10

## Estado consolidado

- Data do checkpoint: 29/08/2026.
- Prioridade dominante: criar uma skill reutilizável para classificação semântica contextual dos protocolos IPM/SEPLANBI.
- Status da unidade: `CONCLUIDA_NO_ESCOPO_LOCAL_AUTORIZADO`.
- Status de classificação de protocolos reais nesta unidade: `NAO_EXECUTADA`.
- Status de homologação administrativa: `PENDENTE`.
- Status do dataset, Git remoto, Vercel e produção: `NAO_ALTERADOS_POR_ESTA_UNIDADE`.

## Entregável

- Skill: `classificar-semantica-seplanbi`.
- Local descobrível: `C:\Users\aniba\.codex\skills\classificar-semantica-seplanbi`.
- Entrada principal: `SKILL.md`.
- Metadados de interface: `agents/openai.yaml`.
- Referências: fontes/campos, método semântico, taxonomia V07 e contrato de saída.
- Scripts: extração da taxonomia canônica, validação formal do lote e testes comportamentais.

## Método implementado

1. Leitura integral de `Último Trâmite - Observação`, `Observação Abertura`, `Subassunto - Descrição` e campos operacionais disponíveis.
2. Reconstrução da sequência mínima entre pedido original, ações, respostas e condição atual.
3. Separação entre objeto, intenção, atividade administrativa, ator, direção do movimento, situação, pendência, resultado, status, evento, categoria e macroprocesso.
4. Reconhecimento explícito de abertura, triagem, análise, diligência, retorno do RT, retorno do requerente, retorno de terceiro/setor, reanálise, encaminhamento, formalização, conclusão operacional, encerramento formal, suspensão, reabertura e correção cadastral.
5. Preservação obrigatória de categoria e macroprocesso históricos sem autorização explícita de reclassificação.
6. Classificação por categoria existente quando o objeto completo se enquadra na taxonomia vigente.
7. Criação de `NOVA_CATEGORIA_CANDIDATA` quando cinco ou mais protocolos distintos são equivalentes por objeto, finalidade, atividade, macroprocesso e limites de inclusão/exclusão.
8. Uso de `Diversos` com macroprocesso explícito quando existirem menos de cinco equivalentes e nenhuma categoria vigente for aplicável.
9. Homologação obrigatória antes de promover candidata, reclassificação histórica ou mudança da taxonomia canônica.

## Taxonomia conferida

- Versão: V07.
- Categorias: 42.
- Macroprocessos: 12.
- Status: 7.
- `Diversos`: associado a `Infraestrutura Urbana e Vias` e `Projetos e Obras Públicas`; o macroprocesso não pode ser inferido silenciosamente.

## Validação

- Todos os 9 arquivos textuais do pacote foram reabertos como UTF-8.
- Compilação Python: aprovada.
- Extração contra o artefato canônico real: aprovada.
- Integração entre taxonomia real e decisão de categoria existente: aprovada.
- Testes comportamentais: 7 de 7 aprovados.
- Casos testados: categoria existente com retorno do RT; bloqueio de alteração histórica; preservação histórica; fallback `Diversos`; candidata com cinco protocolos; bloqueio de chaves de dados pessoais; bloqueio honesto por dados insuficientes sem inventar status ou macroprocesso.
- Estrutura equivalente aos controles do `quick_validate.py`: aprovada para nome, descrição, frontmatter, placeholders e referências.
- Interface `openai.yaml`: aprovada para nome, descrição e prompt de invocação.

## Limitação ambiental da validação oficial

O `quick_validate.py` fornecido pela `skill-creator` não concluiu porque nenhum runtime Python disponível possuía `PyYAML`. A tentativa de preparar a dependência em diretório temporário foi bloqueada pela política do ambiente antes da instalação. Não houve instalação permanente. Os mesmos controles não dependentes de YAML foram reproduzidos com biblioteca padrão e aprovados, mas isso não deve ser descrito como execução bem-sucedida do validador oficial.

## Preservações e privacidade

- Nenhum arquivo de dados ou protocolo foi alterado pela criação da skill.
- Nenhuma observação livre, nome ou CPF/CNPJ foi incorporado à skill.
- As alterações preexistentes na árvore Git foram preservadas.
- Nenhum commit, push, deploy ou aplicação no dataset foi realizado.
- Saídas detalhadas da skill devem permanecer privadas; somente campos minimizados podem seguir para o artefato público após os gates vigentes.

## Próxima ação

1. Invocar `$classificar-semantica-seplanbi` sobre um lote privado preparado pelo modo `PREPARAR`.
2. Conferir a saída JSON e executar `scripts/validar_lote.py` da skill.
3. Submeter baixa confiança, reclassificações e categorias candidatas à homologação administrativa.
4. Somente depois adaptar o pipeline para consumir macroprocesso explícito no fallback `Diversos` e categorias novas homologadas.
