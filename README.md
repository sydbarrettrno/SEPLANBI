# SEPLAN | Gestão à Vista

Dashboard institucional da Secretaria de Planejamento de Itapoá-SC para acompanhamento dos protocolos 2025+.

## Fonte oficial dos números

O **Excel é a fonte de verdade** do dashboard.

Fluxo de atualização:

`BASE2326ETL.xlsx externo → conferência → memória V07 fixa → sanitização → data/final_chunks → revisão do diff`

O arquivo Excel bruto **não é publicado** no GitHub porque contém dados pessoais e observações livres. O importador lê a aba `BASE23-26`, mantém apenas os campos necessários aos indicadores e preserva a classificação V07 por protocolo. Protocolos novos ou com alteração operacional exigem uma planilha semântica auditada; não existe fallback automático.

**Carga atual:** derivada de `BASE2326ETL.xlsx`, com 6.975 protocolos de 2025+ e dados até 22/08/2026. O Excel permanece fora do repositório.

Para atualizar no Windows:

```bat
scripts\ATUALIZAR_DASHBOARD.bat "C:\caminho\BASE2326ETL.xlsx" "C:\caminho\SEPLAN_AUDITORIA_CLASSIFICACAO_STATUS_V01.xlsx"
```

O script primeiro confere e depois aplica localmente o artefato derivado. Em seguida valida minimização, indicadores e regressões. Ele **não executa** `git add`, `commit`, `push` nem deploy; o diff deve ser revisado antes do versionamento.

Também é possível executar somente a importação:

```powershell
python scripts\importar_excel.py "C:\caminho\BASE2326ETL.xlsx"
```

Quando houver protocolos novos ou alterações operacionais, a planilha de auditoria semântica deve ser informada:

```powershell
python scripts\importar_excel.py "C:\caminho\BASE2326ETL.xlsx" --semantic-audit "C:\caminho\SEPLAN_AUDITORIA_CLASSIFICACAO_STATUS_V01.xlsx"
```

## Arquitetura

- **Frontend:** HTML + CSS + JavaScript nativos, sem framework e sem etapa de build.
- **Backend:** Python padrão em `api/index.py`, compatível com Vercel Python Functions.
- **Regra de negócio:** `backend/core.py` concentra filtros, métricas, auditoria e drill-down.
- **Fonte operacional:** Excel local/privado.
- **Dados publicados:** um único transporte canônico sanitizado em `data/final_chunks/`; o backend usa somente o manifesto, recompõe o GZIP e valida tamanho + SHA-256 antes da carga.
- **Privacidade:** não são publicados nomes, CPF/CNPJ, observações livres nem campos auxiliares do ETL. Protocolo e datas continuam identificadores indiretos; a base é minimizada, não anonimizada.
- **Deploy:** GitHub `main` → Vercel, frontend e API no mesmo domínio.

Não existe dependência de Node/npm para executar o dashboard localmente.

## Rodar localmente

```powershell
python scripts\validate.py
python -m unittest discover -s tests -v
python scripts\dev.py
```

Acesse:

- Dashboard: `http://localhost:8000`
- Saúde do backend: `http://localhost:8000/api?action=health`

A publicação deve ser bloqueada se a auditoria da base falhar. O workflow `.github/workflows/ci.yml` executa validação e testes em cada push/PR.

## Indicadores

Os 11 indicadores oficiais da Chefia permanecem como referência do produto. Indicadores sem fonte suficiente aparecem explicitamente como **não integrados**, sem números inferidos.

Consulte `docs/INDICADORES.md` e `docs/AUDITORIA.md`.
