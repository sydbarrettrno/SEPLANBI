# Dataset sanitizado do dashboard

O repositório público contém somente uma visão derivada e sanitizada do corpus 2025+.

O único transporte canônico está em `data/final_chunks/`: partes Base64 de um GZIP validado. O backend concatena as partes na ordem registrada em `data/metadata.json`, decodifica Base64, verifica tamanho e SHA-256, descomprime o payload e só então libera os indicadores.

O dataset guarda números de protocolo, datas codificadas como deslocamento, macroprocesso, categoria, status operacional, tipo/data de saída, setor atual institucional e uma impressão digital não reversível. O setor é completo somente para a fotografia do estoque, porque a V04 não fornece lotação histórica dos protocolos já encerrados. A carteira pública complementar guarda somente ID, fase, status e data de referência dos projetos. Não publica nomes de pessoas, CPF/CNPJ, observações livres nem campos auxiliares do ETL. O gargalo exibido é derivado deterministicamente do status pelo backend.

Esta é uma base minimizada, não anonimizada: protocolo e datas podem permitir correlação indireta. A decisão sobre restringir também o drill-down permanece administrativa.

Antes de responder indicadores, o backend também valida total de registros, unicidade de `ProtocoloID`, coerência temporal e ausência dos campos proibidos.

## Atualização oficial V06/V04 — 30/08/2026

O comando `scripts/atualizar_bases_validadas.py` reconcilia por `ProtocoloID` a base mestre V06 e as abas de indicadores V04. A V06 preserva categoria e macroprocesso; a V04 separa `Concluído` e `Encerrado`, fornece a data/tipo de saída e inclui 20 projetos públicos com referência única em 27/08/2026.

A camada publicada trabalha exatamente com seis status. O alias residual `Em Formalização` é normalizado para `Finalização Interna` conforme a regra explícita desta rodada; os rótulos históricos de espera externa e suspensão são consolidados somente nos eventos preservados, sem recriar esses status na posição atual.

Os campos `ResponsavelInterno`, `NomeRequerente`, `ResponsavelTecnico`, `PessoaResponsavelExterna`, `TipoPessoaResponsavel` e `ObservacaoUltimoTramite` ficam no artefato local privado externo ao repositório. O módulo `backend/private_data.py` não está ligado a nenhuma rota da API.

## Fluxo incremental IPM legado

O export atual do IPM usa a aba `Report` e, na fonte de 29/08/2026, possui 24 colunas, incluindo `Det. Situação - Fluxo`. O comando `scripts/ATUALIZAR_RELATORIO_IPM.bat` faz mapeamento explícito dos cabeçalhos, recupera categoria e macroprocesso da memória V07 por protocolo e separa o fluxo em três modos:

1. `PREPARAR`: gera uma auditoria privada apenas com protocolos novos ou alterados;
2. `CONFERIR`: valida a auditoria preenchida sem escrever em `data/`;
3. `APLICAR`: troca o artefato local de forma transacional e executa os gates.

Protocolos existentes mantêm a categoria histórica. Status e tipo de evento só mudam após auditoria semântica registrada; a homologação administrativa é um gate separado. Datas de encerramento históricas não são apagadas quando o novo relatório vier vazio.

A impressão digital operacional V03 exclui `Última Atividade`, porque esse campo é apenas um contador relativo ao dia da exportação (`Hoje`, `3 Dias`, etc.) e não comprova nova movimentação. A migração da V02 para a V03 exige o relatório privado anterior com hash correspondente ao dataset vigente.

O histórico de movimentos fica dentro do mesmo artefato canônico, sem observações livres. Cada extração registra no máximo o último evento observado por protocolo; por isso, múltiplos trâmites ocorridos entre dois relatórios podem não ser recuperados e essa cobertura deve acompanhar qualquer KPI futuro de tramitações ou diligências.
