# MODELO ANALÍTICO SEPLANBI V01

## 1. Objetivo e contrato

- Contrato: `seplanbi-analytics-v1`.
- Fonte canônica: `data/metadata.json` + `data/final_chunks/`, esquema público v9.
- Implementação central: `backend/analytics.py`.
- API pública de consulta: `GET /api?action=analytics`.
- Exportação pública sanitizada: `GET /api?action=analytics-export`.
- Camada privada: carregada somente no backend por `backend/private_data.py`; não há rota pública para PII.

Fluxo:

```text
dataset canônico
  → enriquecimento analítico único
  → aplicação de filtros
  → seleção do universo do indicador
  → agrupamento / totais / drill-down
  → API
  → componentes React
```

O endpoint legado `dashboard` reutiliza as funções centrais para os universos de recebidos, saídas e estoque. O frontend não classifica protocolos nem recalcula a semântica dos KPI.

## 2. Universos e fórmulas

### 2.1 Recebidos

```text
Recebido = DataAbertura pertencente ao período do indicador
```

- Data temporal: `DataAbertura`.
- Comparação: mesmo intervalo deslocado em um ano.
- Agregações preparadas: ano, mês, macroprocesso, categoria e setor.
- Hierarquia: `Ano → Mês → Macroprocesso → Categoria → Protocolos`.

### 2.2 Saídas

```text
Saídas = Concluído + Encerrado
Saldo do período = Recebidos - Saídas
```

- Data temporal: `DataSaida`.
- `Concluído` e `Encerrado` permanecem separados em `TipoSaida`.
- Agregações preparadas: ano/mês de saída, macroprocesso, categoria, tipo de saída e setor.
- Hierarquia: `Ano → Mês → Macroprocesso → Categoria → Tipo de saída → Protocolos`.

### 2.3 Estoque

```text
Estoque = todos os status não terminais na data de referência
Estoque = Fila Interna SEPLAN + Aguardando Responsável Externo + Paralisado
```

- Data de referência: `source_updated_at` do dataset canônico.
- Fila interna: `Em Análise` + `Finalização Interna`.
- Idade do estoque: dias entre `DataAbertura` e a data de referência.
- Dias sem movimentação: dias entre `UltimoTramiteDataHora` e a data de referência; não é usado como sinônimo de idade.
- Faixas: `0–30`, `31–60`, `61–90`, `91–180` e `181+ dias`.
- Agregações públicas: responsabilidade, macroprocesso, categoria, setor, status e idade.
- Agregação por responsável interno: função privada `private_stock_by_internal_responsible`, sem rota pública.
- Hierarquia: `Responsabilidade → Macroprocesso → Categoria → Status → Protocolos`.

## 3. Filtros e cruzamento

O contrato aceita:

- `from` e `to`;
- `year`;
- `month`;
- `macro`;
- `category`;
- `status`;
- `sector`;
- `responsibility`;
- `output_type`;
- `q` para pesquisa;
- `group_by` para uma ou mais dimensões;
- `sort_by`, `sort_dir`, `offset` e `limit` para o drill-down.

Seleções múltiplas usam `|`. A mesma consulta é aplicada antes dos totais, grupos e protocolos, garantindo filtragem cruzada. A resposta devolve `filters.active`, `clear_action` e `breadcrumb`.

Regra temporal:

- recebidos: período/ano/mês referem-se à abertura;
- saídas: período/ano/mês referem-se à saída;
- estoque: é uma fotografia atual; período explícito, ano e mês funcionam como coorte de abertura e não reconstroem estoque histórico.

## 4. Drill-down e privacidade

### 4.1 Público

A rota pública devolve somente:

- protocolo e ID técnico;
- data de abertura;
- último trâmite;
- macroprocesso;
- categoria;
- status;
- dias sem movimentação;
- setor.

São suportados pesquisa, filtros, ordenação, paginação, chave de clique pelo protocolo e exportação CSV da mesma allowlist pública.

### 4.2 Privado

O backend privado pode juntar, somente após autorização explícita do chamador:

- responsável interno;
- pessoa responsável externa;
- tipo da pessoa responsável;
- nome do requerente;
- responsável técnico;
- observação do último trâmite.

O deployment atual não autentica nem autoriza leitura de usuários. Por isso:

- `private_detail = false` na API pública;
- `private_export = false` na API pública;
- nenhuma rota pública importa o carregador privado;
- a função privada exige `PrivateAuthorization(authenticated=True, can_view_pii=True)`;
- exportação privada continua negada até autorização específica.

## 5. Limitação de setor

`SetorAtual` e `ResponsavelInterno` existem somente na aba `03_ESTOQUE` da V04. Portanto:

- setor é completo para os 2.158 protocolos do estoque atual;
- recebidos e saídas sem registro atual de estoque recebem `Não informado na fonte`;
- não foi inferido setor histórico;
- responsável interno permanece privado e possui preenchimento somente onde a V04 o fornece.

## 6. Números de controle em 28/08/2026

- Recebidos em 01/01/2026–28/08/2026: 2.898.
- Recebidos no período homólogo de 2025: 2.825.
- Saídas no período: 2.293.
  - Concluído: 961.
  - Encerrado: 1.332.
- Saldo: +605.
- Estoque: 2.158.
  - Fila Interna SEPLAN: 1.544.
  - Aguardando Responsável Externo: 583.
  - Paralisado: 31.
- Idade do estoque:
  - 0–30 dias: 345.
  - 31–60 dias: 233.
  - 61–90 dias: 125.
  - 91–180 dias: 357.
  - 181+ dias: 1.098.

## 7. Testes do contrato

`tests/test_analytics.py` comprova:

- recebidos filtrados = soma das categorias;
- saídas = concluído + encerrado;
- estoque = interno + externo + paralisado;
- seleção de categoria = conjunto exato de protocolos;
- comparação homóloga parcial;
- faixas de idade completas e exclusivas;
- setor completo no estoque e ausência histórica explícita;
- PII ausente da resposta e exportação públicas;
- autorização obrigatória para o drill-down privado.
