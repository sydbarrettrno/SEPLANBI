# BASELINE PROVENANCE SEPLANBI V01

## Identificação

- Data: 26/08/2026
- Origem: `https://github.com/sydbarrettrno/seplanitapoa`
- Commit: `24e1be66207d44c1085765ccb65105b9b890535c`
- Mensagem: `Header institucional — Município de Itapoá / SEPLAN`
- Destino local: `C:\SEPLANBI`
- Repositório remoto de destino: `https://github.com/sydbarrettrno/SEPLANBI`
- Situação remota: nenhum push realizado neste checkpoint.

## Escopo importado

- Arquivos rastreados na origem: 80.
- Arquivos do dashboard importados: 61.
- Arquivos excluídos de `apps/motor-cad`: 19.
- `apps/motor-cad` no destino: ausente.

O conjunto importado corresponde a todos os arquivos rastreados do commit, exceto caminhos iniciados por `apps/motor-cad/`.

## Impressões digitais

- Árvore de 61 arquivos na origem, SHA-256 agregado: `693d4e0626781cdf979d96e302f0cd58791250a0b4138c24258b66d6f30ad91f`.
- Árvore no destino após a correção local, SHA-256 agregado: `79b012079f3ea006b0d542d60d376895162c19459ba3050e7a320259774f9ebd`.
- Conjunto `data/final_chunks`, SHA-256 agregado: `27b15c155d1709c1c5e617656345fe7a8c2b4d0d3241f445717a7ec9c319e06b`.

Hashes críticos no destino:

| Arquivo | SHA-256 |
|---|---|
| `index.html` | `da2d7e42d71517c7ffb41db24300026428cf15e26ddf4e8490926073e1c04ec5` |
| `api/index.py` | `0e91e2d2ff4f992fdcd8503d4d0b855e94e87a1b7e4311f316bca14b27c7a6fa` |
| `backend/final_entry.py` | `f4a0df0cc73affada078db74130eefb768c3c9b066b38617ff14b334238d26b7` |
| `data/metadata.json` | `6e0b485a5a1a66891df8f0b94a5b7d05acdb12a30ded7d72f50498ff76634a69` |
| `assets/logo-municipio-itapoa.png` | `fa6e7a8daf8a82e2af17a93d15e8bdc958e53892156e351a87712869dde96836` |
| `scripts/dev.py` corrigido | `c2eb9857e5a2bc5d29586311bc4844a5ebd5eaeb228aa5c0f476463cda068ee2` |

## Diferença intencional

Somente `scripts/dev.py` difere do commit de origem:

- origem: `853399ed0a0c133bdbacdfcbd7748174397702dc31f827d7ca2465567d7b97c2`;
- destino: `c2eb9857e5a2bc5d29586311bc4844a5ebd5eaeb228aa5c0f476463cda068ee2`.

Alteração:

```text
backend.core → backend.final_entry
```

Justificativa: `api/index.py`, `scripts/validate.py` e a produção usam `backend.final_entry`; o servidor local usava a carga legada e exibia indicadores divergentes. A correção alinha o ambiente local sem alterar dados ou fórmulas.

## Dados declarados no manifesto de origem

- Dataset: base pública sanitizada V07.
- Linhas: 6.975.
- Data da fonte: 22/08/2026.
- Taxonomia: V07, com 632 overrides.
- Fonte declarada: `SEPLAN_BASE_TAXONOMIA_V07.xlsx`, aba `BASE`.
- Artefato entregue: `data/final_chunks`.
- Transporte legado preservado: `data/safe_chunks`.

## Privacidade

- 35 arquivos textuais fora dos chunks foram triados quanto a padrões de credencial, e-mail e CPF; nenhum arquivo foi sinalizado.
- O teste `test_pii_not_in_dataset_schema` passou.
- Isso valida o snapshot público, mas não autoriza publicar o Excel original.
