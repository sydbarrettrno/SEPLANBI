# Pipeline incremental IPM — SEPLANBI V01

## 1. Objetivo

Receber o `Relatorio.xlsx` exportado pelo IPM, recuperar a classificação histórica V07 por protocolo, identificar protocolos novos e alterações, exigir revisão humana para status/evento e gerar o mesmo artefato sanitizado consumido pelo SEPLANBI.

## 2. Entrada auditada

- Arquivo: `Relatorio.xlsx` externo ao repositório.
- SHA-256: `E9741710156B9964E18E8BC7FA3B60562F734981DCAD836CF6090A5BD16A69AD`.
- Aba: `Report`.
- Faixa estrutural: `A1:W14989`.
- Registros 2025+: 7.020.
- Protocolos 2025: 4.165.
- Protocolos 2026: 2.855.
- Último trâmite máximo: `2026-08-26 16:02:53`.

O arquivo possui dados pessoais e observações livres. Ele permanece fora do Git.

## 3. Reconciliação com a memória publicada

- Memória V07 atual: 6.975 protocolos.
- Protocolos ausentes no novo relatório: zero.
- Protocolos novos: 45.
- Protocolos existentes com alteração relevante: 196.
- Linhas que exigem auditoria: 241.
- Encerramentos históricos preservados porque vieram vazios no novo relatório: 2.

A detecção usa mapeamento explícito dos cabeçalhos IPM. Para compatibilidade com o hash histórico, `CCAtual` corresponde a `Centro de Custo Atual - Descrição`; a nova impressão digital V2 também incorpora classificação do centro de custo, data/hora exata, última atividade e hash não reversível da observação do último trâmite.

## 4. Regra semântica

- Categoria e macroprocesso existentes são recuperados da memória V07 e permanecem imutáveis no fluxo automático.
- Protocolo novo exige categoria V07 e status preenchidos na auditoria.
- Protocolo existente alterado exige status e tipo de evento preenchidos na auditoria.
- Categoria nova ou categoria sem macroprocesso unívoco é bloqueada.
- Auditoria incompleta não altera `data/metadata.json` nem `data/final_chunks`.

Tipos de evento aceitos:

- `TRAMITACAO`;
- `DILIGENCIA`;
- `ENCERRAMENTO`;
- `REABERTURA`;
- `CORRECAO_CADASTRAL`;
- `OUTRO`;
- `NAO_DETERMINADO`;
- `INCLUSAO`.

## 5. Histórico de movimentos

Os eventos sanitizados ficam no mesmo GZIP Base64 canônico do snapshot, em vetores compactos:

- `p`: índice do protocolo;
- `a`: minutos desde `2025-01-01 00:00`;
- `k`: índice do tipo de evento;
- `s`: índice do status após o evento.

Observações livres, nomes, CPF/CNPJ e responsáveis nominais não entram no artefato.

Limitação obrigatória: o IPM exporta somente o último trâmite. Cada extração pode registrar no máximo o último evento observado por protocolo. Vários trâmites ocorridos entre duas extrações não são reconstruíveis. Qualquer KPI futuro deve informar a data inicial e essa cobertura; `TRAMITACAO` e `DILIGENCIA` são os tipos contáveis.

## 6. Operação

Preparar auditoria privada:

```bat
scripts\ATUALIZAR_RELATORIO_IPM.bat "C:\caminho\Relatorio.xlsx" PREPARAR "C:\privado\auditoria.csv"
```

Conferir sem escrever:

```bat
scripts\ATUALIZAR_RELATORIO_IPM.bat "C:\caminho\Relatorio.xlsx" CONFERIR "C:\privado\auditoria_preenchida.xlsx"
```

Aplicar localmente após conferência:

```bat
scripts\ATUALIZAR_RELATORIO_IPM.bat "C:\caminho\Relatorio.xlsx" APLICAR "C:\privado\auditoria_preenchida.xlsx"
```

O modo `APLICAR` atualiza apenas o repositório local, valida privacidade, indicadores e testes. Não executa Git, push, Vercel ou deploy.

## 7. Validação V01

- 25 testes Python aprovados.
- Validação dos indicadores atuais aprovada sobre a última base publicada válida.
- Privacidade/minimização aprovadas sobre a última base publicada válida.
- Determinismo do payload com eventos aprovado em teste.
- Auditoria incompleta real bloqueada: 196 alterações sem status/tipo de evento e 45 novos sem categoria/status.
- Template Excel verificado visualmente nas abas `INSTRUCOES`, `AUDITORIA_ATUALIZACAO`, `DICIONARIOS` e `MANIFESTO`.
- Git e deploy não executados.

## 8. Estado

O código e o template estão utilizáveis. A substituição do dataset no GitHub permanece bloqueada até a revisão humana das 241 linhas e nova execução em `CONFERIR` e `APLICAR`.
