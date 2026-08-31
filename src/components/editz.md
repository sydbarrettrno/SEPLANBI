Local Edição  
src/App.tsx  
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/App.tsx  
Recebidos  
src/components/BiPanel.tsx  
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/BiPanel.tsx  
Saídas  
src/components/BiPanel.tsx  
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/BiPanel.tsx  
Estoque  
src/components/BiPanel.tsx  
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/BiPanel.tsx  
Tempo de Tramitação  
src/components/ExtendedIndicatorPanel.tsx — seção kpi === 4 e objeto COPY[4]  
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/ExtendedIndicatorPanel.tsx  
Processos Parados  
src/components/ExtendedIndicatorPanel.tsx — seção kpi === 5 e COPY[5]
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/ExtendedIndicatorPanel.tsx
Dentro do Prazo
src/components/ExtendedIndicatorPanel.tsx — kpi === 6 e COPY[6]
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/ExtendedIndicatorPanel.tsx

Protocolos
Página/estrutura principal: src/App.tsx
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/App.tsx

Conteúdo dos indicadores dentro da página: src/components/IndicatorDetail.tsx
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/IndicatorDetail.tsx

Tabela dos protocolos: src/components/DrilldownTable.tsx
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/DrilldownTable.tsx

Indicadores
Página: src/components/IndicatorCoverage.tsx
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/IndicatorCoverage.tsx

Nome, status e explicação dos 11 indicadores vêm de: backend/delivery_core.py, no array INDICATOR_COVERAGE
https://github.com/sydbarrettrno/SEPLANBI/blob/main/backend/delivery_core.py

Administração
src/components/AdminDescriptions.tsx
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/AdminDescriptions.tsx
E o menu lateral em si

Para alterar os textos como “Visão executiva”, “Recebidos”, “Produção e saldo”, “Fila e concentração”, ícones e legendas abaixo dos nomes:

Menu/Navegação lateral
src/components/Sidebar.tsx — objeto NAV_ITEMS
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/Sidebar.tsx
Indicadores que ainda não aparecem na imagem

Os demais painéis usam o mesmo arquivo do 5–7:

Diligências — KPI 07
ExtendedIndicatorPanel.tsx → COPY[7] / kpi === 7
Fiscalizações — KPI 08
ExtendedIndicatorPanel.tsx → COPY[8] / kpi === 8
Denúncias — KPI 09
ExtendedIndicatorPanel.tsx → COPY[9] / kpi === 9
Projetos Públicos — KPI 10
ExtendedIndicatorPanel.tsx → COPY[10] / kpi === 10
Pendências por responsável/setor — KPI 11
ExtendedIndicatorPanel.tsx → COPY[11] / kpi === 11

Todos 12–16:
https://github.com/sydbarrettrno/SEPLANBI/blob/main/src/components/ExtendedIndicatorPanel.tsx
