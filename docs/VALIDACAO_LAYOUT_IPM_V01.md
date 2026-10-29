# Validação do layout IPM — V01

Data de inspeção: 29/10/2026.

## Escopo

Arquivo externo fornecido pelo usuário: Relatorio(1).xlsx. **Não incluir esse arquivo no Git.** A inspeção local foi executada com leitura somente dos campos necessários do XML interno do XLSX e sem impressão de dados pessoais.

## Evidência da inspeção do relatório

- Aba: Report.
- Colunas: 16.
- Linhas não vazias: 3.734 (excluído cabeçalho).
- Protocolos distintos: 3.734.
- Protocolos inválidos: 0.
- Protocolos duplicados: 0.
- Inconsistências nas datas de abertura / último trâmite / encerramento: 0, pelas verificações executadas.
- Ano presente: 2026 (3.734 registros).
- Situações originais, sem reclassificação: Aberto 7; Tramitando 1.646; Encerrado 1.814; Em Análise 179; Cancelado 41; Paralisado 28; Arquivado 19.

## Compatibilidade

A coluna Situacao (sem acento) foi adicionada aos aliases do backend. Os demais campos essenciais já eram reconhecidos: Protocolo, DataAbertura, DataUltTramite, Assunto e CCAtual. Foi criado teste automatizado sintético para a variante de 16 colunas.

## Limites e gates

- A auditoria do XLSX real **não equivale a executar toda a API Vercel/Blob nem o teste unitário em ambiente de produção**.
- O relatório entregue contém apenas protocolos de 2026; ele **não pode ser considerado a base consolidada 2025–2026** nem justificar remoção de registros históricos ausentes.
- O upload/comparação existente ainda não gera nem publica os KPIs.
- Nenhuma classificação operacional foi modificada.
- Falta provar reconciliação do histórico completo e do recálculo dos indicadores em pré-produção antes de qualquer publicação.
