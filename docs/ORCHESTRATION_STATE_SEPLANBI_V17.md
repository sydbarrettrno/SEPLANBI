# ORCHESTRATION_STATE_SEPLANBI_V17

## Checkpoint
Seção individualizada **Construção Civil** incorporada ao SEPLANBI e publicada em produção.

## Objetivo entregue
Disponibilizar, dentro do SEPLANBI, uma leitura executiva da evolução dos alvarás de construção de Itapoá com base na extração do Sistema IPM realizada em 04/09/2026, sem expor dados pessoais ou microdados cadastrais no frontend público.

## Escopo funcional
- nova rota pública `#/construction`;
- item `Construção Civil` no menu, seção `Gestão`;
- 4 KPIs de 2016–2025;
- evolução anual de alvarás totais e construção nova;
- evolução anual da área autorizada de construção nova;
- composição anual por uso;
- comparação equivalente 01/01–03/09/2025 x 01/01–03/09/2026;
- notas de interpretação e limitações da fonte.

## Regras estatísticas preservadas
- eixo temporal: `Data de Liberação`;
- área autorizada principal: somente `Tipo de Alvará = CONSTRUÇÃO`;
- 2026 é YTD e não é comparado diretamente com anos completos;
- `RESIDENCIAL` sem modalidade explícita não é convertido em unifamiliar;
- industrial/portuário não é automaticamente classificado como logístico;
- coeficiente de aproveitamento e outorga onerosa permanecem indisponíveis na fonte, sem inferência;
- alvará representa atividade autorizada, não obra concluída.

## Privacidade
Somente dados agregados foram incorporados ao frontend. Não foram publicados titular, CPF/CNPJ, cadastro, inscrição imobiliária, endereço ou arquivo bruto do IPM.

## GitHub
- Branch de desenvolvimento: `feat/construcao-civil`
- Commit de implementação: `4cdbcab0bde9173f42f42e6977aa4101861c4a55`
- Pull Request: `#22`
- Merge squash em `main`: `24922dd9206ced5528c369440194040ae0aca64a`

## Validações
- CI do Pull Request: sucesso — run `22811387330`;
- CI em `main`: sucesso — run `22811441003`;
- Vercel preview: READY — `dpl_Awxw1CmV9WY8XVfZuDkqPxYWacUb`;
- Vercel produção após merge: READY/current — `dpl_4XvU3WSAKyYUF4wXhKpkPEwfWh75`;
- domínio de produção: `seplanbi.vercel.app`.

## Rollback
Checkpoint anterior de produção: commit `de358a614c8b92d671ef7c28bbc7a776ef73aaf4` / deployment `dpl_ARvHt3HeKvfiG9JTWzkunkyFnMau`.

## Observação
Não houve inspeção visual automatizada por navegador neste checkpoint. A validação executada cobriu build TypeScript/Vite, CI, verificação de privacidade e disponibilidade do deployment Vercel.
