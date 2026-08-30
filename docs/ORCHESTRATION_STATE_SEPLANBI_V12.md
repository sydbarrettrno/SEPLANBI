# ORCHESTRATION STATE SEPLANBI V12

## Estado obrigatório

- `objetivo`: atualizar e auditar localmente a base operacional do SEPLANBI com a V06 mestre e a V04 de indicadores, sem publicar nem desenvolver novos painéis.
- `escopo_incluido`: pipeline XLSX → artefato canônico → API → React; seis status autorizados; saídas; estoque; Projetos Públicos de 27/08/2026; privacidade; testes; camada privada local sem rota.
- `escopo_excluido`: novo painel, mudança de layout, nova classificação semântica, commit, push, Vercel, deploy, corte de produção e exposição de PII.
- `etapa_atual`: checkpoint final da Etapa 1.
- `prioridade_dominante`: integridade e privacidade da atualização V06/V04.
- `acao_em_curso`: nenhuma; aguardando próximo prompt.
- `status_da_entrega`: `CONCLUIDA_NO_ESCOPO_APROVADO`.
- `status_do_briefing`: `PRONTO_PARA_ORGANIZAR` e executado conforme autorização do pedido.
- `condicoes_de_parada`: parar após atualização, testes, auditoria, registro e apresentação; não publicar.
- `dependencias`: fontes externas V06/V04 preservadas em Downloads; runtime local; autenticação futura para qualquer drill-down com PII.
- `responsavel_atual`: usuário, para definir a próxima etapa.
- `autorizacoes_e_limites`: escrita local no repositório e camada privada local autorizadas pelo escopo; Git remoto e Vercel não autorizados.
- `baseline_preservado`: dataset anterior copiado para `outputs/20260830-etapa1/rollback_pre_v06v04/data/` antes da aplicação.
- `criterio_de_conclusao`: fontes reconciliadas; 7.063 protocolos únicos; partição saída/estoque; seis status exatos; Projetos Públicos em 27/08/2026; privacidade e testes aprovados; nenhuma publicação.
- `evidencia_esperada`: hashes das fontes, metadados canônicos, testes, HTTP local, build e navegador local.
- `versao`: V12.
- `data_de_corte`: dados operacionais em 28/08/2026; Projetos Públicos em 27/08/2026; checkpoint em 30/08/2026.

## Fontes e rastreabilidade

- `BASE_SEPLANBI_RECLASSIFICADA_VALIDADA_29082026_V06.xlsx`
  - tamanho: 14.534.480 bytes;
  - SHA-256: `322ca9274d587b29285b94bb2206bf1e65a5b841b662a1826564f7921e45ccd8`;
  - camada usada: `BASE_SISTEMA_VALIDADA`;
  - movimentos preservados: `MOVIMENTOS`.
- `BASE_INDICADORES_SEPLAN_30082026_V04.xlsx`
  - tamanho: 3.741.473 bytes;
  - SHA-256: `9c582b8551567c8bfc32a5f9e38d31ce2b31f5c38481f49835765904a6075b35`;
  - abas reconciliadas: `01_RECEBIDOS`, `02_SAIDAS`, `03_ESTOQUE` e `10_PROJETOS_PUBLICOS`;
  - camada privada derivada somente dos campos autorizados da `01_RECEBIDOS`.

## Resultado quantitativo

- Universo 2025+: 7.063 protocolos.
- Protocolos únicos: 7.063.
- Duplicidades: 0.
- Período de abertura: 02/01/2025 a 28/08/2026.
- Recebidos em 2026 até o corte: 2.898.
- Saídas acumuladas: 4.905.
- Saídas em 2026 até o corte: 2.293.
- Saídas por fonte: 4.066 por data de encerramento formal; 839 por último trâmite operacional.
- Estoque atual: 2.158.
- Projetos Públicos: 20, todos contabilizáveis, referência única em 27/08/2026.

### Distribuição atual por status

- `Em Análise`: 1.478.
- `Finalização Interna`: 66.
- `Aguardando Responsável Externo`: 583.
- `Paralisado`: 31.
- `Concluído`: 1.756.
- `Encerrado`: 3.149.

## Decisões

1. Categoria e macroprocesso foram copiados da V06; não houve nova classificação semântica.
2. Sete ocorrências residuais de `Em Formalização` foram normalizadas para `Finalização Interna`, porque a lista do pedido é exclusiva e a própria V06 registra essa equivalência como regra validada.
3. Os eventos históricos foram preservados com normalização dos rótulos legados para a taxonomia atual; a posição atual contém somente os seis status autorizados.
4. `DataEncerramento` permanece como encerramento formal; `DataSaida` e `TipoSaida` preservam a saída operacional informada pela V04.
5. Projetos Públicos entram no transporte público apenas com ID, fase, status e data de referência.
6. O frontend continua consumindo `/api?action=dashboard`; o arquivo oficial é `data/metadata.json` com `data/final_chunks/`.
7. A senha administrativa existente protege somente a escrita de textos e não autentica a leitura pública do dashboard; PII não foi ligada à API.

## Privacidade

- Artefato público: `data/final_chunks/`, allowlist de campos e sem PII/observações livres.
- Artefato privado local: `C:\Users\aniba\AppData\Local\SEPLANBI\private\BASE_PRIVADA_PROTOCOLOS_30082026_V01.json.gz`.
- Registros privados: 7.063.
- ACL verificada: somente `ANIBAL\anibal` com controle total.
- Carregador backend: `backend/private_data.py`, condicionado a `SEPLANBI_PRIVATE_DATA_PATH`.
- Rotas públicas conectadas à camada privada: 0.
- Exibição segura no frontend atual: `NÃO`, porque não há autenticação/autorização de leitura de usuários.

## Evidências obtidas

- Reconciliação V06/V04 por protocolo: 0 divergência nos campos canônicos.
- Partição: 4.905 saídas + 2.158 estoque = 7.063; interseção = 0.
- Regra `PessoaResponsavelExterna`: 7.063 avaliados; 0 divergência da prioridade Responsável/RT com fallback Requerente.
- Fórmulas na V04: nenhuma fórmula e 0 correspondência de erro de fórmula.
- Testes Python: 29 aprovados.
- Validador de indicadores: aprovado.
- Validador de privacidade: aprovado; 7.063 linhas, 396 eventos e 20 projetos públicos; 0 arquivo privado rastreado.
- Build React: aprovado com TypeScript 7.0.2 e Vite 8.2.2.
- API HTTP local: `health=ok`, 7.063 linhas únicas, seis status exatos e referência dos projetos em 27/08/2026.
- Navegador local: página com conteúdo, sem overlay, sem erro/warning de console, texto `Processos paralisados` presente e nenhum rótulo de suspensão.
- Produção consultada em modo somente leitura: `https://seplanbi.vercel.app/` e sua API responderam `200` sem desafio `WWW-Authenticate`; o dataset remoto permaneceu na versão anterior, confirmando que não houve publicação desta unidade.
- Git, push, Vercel e deploy: não executados.

## Erros e limitações

- A V06 possui `Content_Types` não canônico: o leitor de artefatos OpenXML recusou o pacote, embora o ZIP tenha integridade e as partes XML usadas tenham sido lidas em modo somente leitura. A fonte não foi regravada.
- A V06/V04 continha sete posições atuais com `Em Formalização`; corrigidas somente na camada derivada.
- O histórico de eventos continua parcial: registra o último movimento observado por extração e não comprova histórico integral.
- Protocolo e datas são identificadores indiretos; a base pública é minimizada, não anonimizada.
- A camada privada está preparada localmente, mas não pode ser exposta até existir autenticação, autorização por perfil, auditoria de acesso e decisão administrativa.

## Histórico de tentativas

1. `xlsx-artifact-v06`: importação read-only pelo leitor OpenXML; resultado: falha por `Content_Types`; abordagem substituída por leitura direta, read-only, do pacote XLSX.
2. `react-build-path`: `npm run build`; resultado: `tsc` não localizado pelo shell do npm; validação concluída pelos binários locais explícitos, sem mudança de código nem lockfile.
3. `private-acl`: primeira ACL deixou o arquivo sem permissão efetiva; corrigida para a identidade real `ANIBAL\anibal`, seguida de leitura integral de 7.063 registros.

## Arquivos alterados

- `backend/core.py`;
- `backend/delivery_core.py`;
- `backend/delivery_v07.py`;
- `backend/private_data.py`;
- `data/metadata.json`;
- `data/final_chunks/part-000` a `part-016`;
- `scripts/atualizar_bases_validadas.py`;
- `scripts/check_data_privacy.py`;
- `scripts/validate.py`;
- `tests/test_core.py`;
- `src/types.ts`;
- `src/format.ts`;
- `src/components/ExceptionPanel.tsx`;
- `src/components/IndicatorDetail.tsx`;
- `README.md`;
- `data/README.md`;
- `docs/ORCHESTRATION_STATE_SEPLANBI_V12.md`.

## Riscos residuais e próxima ação

- `riscos_residuais`: pacote OpenXML V06 não canônico; histórico parcial; identificadores indiretos; ausência de autenticação para PII; alterações locais ainda não versionadas.
- `validacoes_pendentes`: homologação humana/administrativa do diff e autorização futura de commit/publicação, se desejada.
- `proxima_acao`: nenhuma automática. Aguardar o próximo prompt.
- `backlog`: autenticação/autorização do drill-down privado; revisão formal do pacote V06; eventual migração do fluxo IPM legado para os seis status.

## Gate focus

- `decisao`: `CONCLUIR`.
- `progresso_material`: atualização local utilizável e verificável.
- `nivel_de_validacao`: estrutural, automatizada, HTTP local, visual local e privacidade.
- `independencia_da_revisao`: autorrevisão; não houve revisor humano independente neste checkpoint.
- `desvios`: nenhum.
- `alegacoes_nao_comprovadas`: homologação administrativa do diff e produção atualizada.
- `pendencias_essenciais`: nenhuma para o escopo local desta Etapa 1.
- `correcao_ou_proxima_acao`: parar e aguardar o próximo prompt.
