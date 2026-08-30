# SEPLAN | Gestão à Vista

Dashboard institucional da Secretaria de Planejamento de Itapoá-SC para acompanhamento dos protocolos 2025+.

## Fonte oficial dos números

O **Excel é a fonte de verdade** do dashboard.

Fluxo de atualização:

`V06 mestre + V04 indicadores (externas) → reconciliação por protocolo → sanitização → data/final_chunks → API → React`

Os arquivos Excel **não são publicados** no GitHub porque contêm dados pessoais e observações livres. A carga oficial desta rodada usa `BASE_SISTEMA_VALIDADA` da V06 para protocolo, datas, macroprocesso, categoria e status; a V04 fornece saídas, estoque, indicadores e a carteira específica de Projetos Públicos com referência em 27/08/2026. Não há nova classificação semântica.

**Carga local atual:** 7.063 protocolos de 2025+ e dados até 28/08/2026. O contrato trabalha somente com `Em Análise`, `Finalização Interna`, `Aguardando Responsável Externo`, `Paralisado`, `Concluído` e `Encerrado`.

Para atualizar no Windows:

```bat
python scripts\atualizar_bases_validadas.py "C:\caminho\BASE_SEPLANBI_RECLASSIFICADA_VALIDADA_29082026_V06.xlsx" "C:\caminho\BASE_INDICADORES_SEPLAN_30082026_V04.xlsx" --private-output "C:\caminho-privado\BASE_PRIVADA_PROTOCOLOS_30082026_V02.json.gz" --apply
```

Sem `--apply`, o comando apenas confere. Com `--apply`, grava de forma transacional o artefato público minimizado e o artefato privado externo ao repositório. Ele **não executa** `git add`, `commit`, `push` nem deploy; o diff deve ser revisado antes do versionamento.

O fluxo incremental IPM anterior permanece documentado para rastreabilidade, mas não substitui as fontes V06/V04 validadas desta rodada.

## Interface React

O novo layout usa React + TypeScript + Vite e mantém a API Python e as regras de negócio existentes. A visão principal foi organizada como **gestão por exceção**:

- cinco sinais executivos com leitura contextual e reação ao passar o mouse;
- linha mensal de recebidos, concluídos e encerrados formais para leitura de tendência e sazonalidade;
- alertas de fila interna parada, dependência externa e paralisações;
- filtros e drill-down até os protocolos do recorte;
- cobertura explícita dos 11 indicadores oficiais;
- edição local das descrições dos cards no painel administrativo.

A edição administrativa desta versão fica somente no navegador do usuário. Ela não altera dados, fórmulas ou regras e ainda não possui autenticação central.

## Arquitetura

- **Frontend:** React 19 + TypeScript + Vite, compilado para `dist/`.
- **Backend:** Python padrão em `api/index.py`, compatível com Vercel Python Functions.
- **Regra de negócio:** `backend/analytics.py` concentra filtros, universos, métricas, agrupamento e drill-down dos KPI 01–03; `backend/core.py` carrega e audita o transporte canônico.
- **Fonte operacional:** Excel local/privado.
- **Dados publicados:** um único transporte canônico sanitizado em `data/final_chunks/`; o backend usa somente o manifesto, recompõe o GZIP e valida tamanho + SHA-256 antes da carga.
- **Privacidade:** não são publicados nomes de pessoas, CPF/CNPJ, observações livres nem campos auxiliares do ETL. O artefato privado é externo ao Git e só pode ser carregado no backend por `SEPLANBI_PRIVATE_DATA_PATH`; não existe rota pública para ele. Como a leitura do dashboard não possui autenticação/autorização de usuários, esses campos não podem ser exibidos com segurança no frontend atual. Protocolo e datas continuam identificadores indiretos; a base é minimizada, não anonimizada.
- **Deploy:** GitHub `main` → Vercel, frontend e API no mesmo domínio.

## Rodar localmente

```powershell
cd C:\SEPLANBI
scripts\BUILD_REACT.bat
python scripts\validate.py
python -m unittest discover -s tests -v
python scripts\dev.py
```

Atalho para compilar e iniciar em uma única ação:

```bat
scripts\INICIAR_DASHBOARD.bat
```

Acesse:

- Dashboard: `http://localhost:8000`
- Saúde do backend: `http://localhost:8000/api?action=health`
- Camada analítica: `http://localhost:8000/api?action=analytics&indicator=received`

Para desenvolver o frontend com atualização imediata, mantenha `python scripts\dev.py` aberto e execute em outro terminal:

```powershell
npm run dev
```

Nesse modo, acesse `http://127.0.0.1:5173`; o Vite encaminha `/api` para a porta 8000.

A publicação deve ser bloqueada se a auditoria da base falhar. O workflow `.github/workflows/ci.yml` executa validação e testes em cada push/PR.

## Indicadores

Os 11 indicadores oficiais da Chefia permanecem como referência do produto. Indicadores sem fonte suficiente aparecem explicitamente como **não integrados**, sem números inferidos.

Consulte `docs/INDICADORES.md` e `docs/AUDITORIA.md`.
