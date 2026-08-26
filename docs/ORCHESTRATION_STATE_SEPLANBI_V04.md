# ORCHESTRATION STATE SEPLANBI V04

## Estado consolidado

- Data de corte: 26/08/2026
- Etapas concluídas: 1 a 3 de 9
- Último checkpoint: B0 — baseline funcional
- Decisão Focus independente: `CONCLUIR`
- Próximo checkpoint: D0 — atualização ponta a ponta dos dados
- Servidor local e abas de teste: encerrados
- Produção, Vercel e repositório antigo: não alterados
- Push para o novo repositório: não realizado

## Git local

- Branch: `main`
- Commit do baseline: `99b6c38` — `Baseline rastreável do dashboard publicado`
- Tag local: `baseline-seplanbi-v01`
- A tag representa o commit publicado de origem `24e1be6` com a correção delimitada de `scripts/dev.py`.
- Motor CAD: ausente.

## Consumo

- Meta S0 final: 44.412 tokens em 9 min 21 s.
- Meta B0 antes deste registro final: 133.620 tokens em 19 min 30 s.
- Orçamento numérico: não definido; saldo exato indisponível.
- A captura de 89% na janela de 5 horas e 77% semanal é anterior ao B0 e deve ser atualizada pelo usuário/interface quando necessário.

## Evidências principais

- Fonte intermediária no SHA exato publicado.
- 61 arquivos do dashboard presentes; 19 arquivos de `apps/motor-cad` excluídos.
- 60 arquivos idênticos à origem e uma diferença intencional em `scripts/dev.py`.
- `scripts/validate.py` aprovado.
- 13 testes aprovados.
- 19 comparações local/produção da API sem divergência.
- Oito rotas renderizadas.
- Página Protocolos com 100 linhas visíveis de 6.975.
- Auditoria independente aprovou o B0.

## Próxima prioridade dominante

Não iniciar React. O próximo modelo deve abrir uma nova meta para D0 e trabalhar exclusivamente no pipeline:

```text
Excel oficial
→ validação de esquema
→ normalização
→ semântica versionada
→ artefato final canônico
→ manifesto
→ API
```

Antes de editar:

1. ler `AGENTS.md` e esta V04;
2. conferir `git status` e `git log --decorate -2`;
3. ler `scripts/importar_excel.py`, `scripts/ATUALIZAR_DASHBOARD.bat`, `backend/final_data.py`, `backend/taxonomy_v07.py` e `data/metadata.json`;
4. identificar o Excel oficial sem copiá-lo para o repositório público;
5. registrar entrada, esquema, autorização e rollback;
6. criar V05 ao concluir ou bloquear D0.

## Dados insuficientes para D0

- localização confirmada do Excel oficial atual;
- confirmação da aba e esquema vigentes;
- política de armazenamento privado da fonte;
- disponibilidade de uma segunda versão ou fixture sanitizada para testar atualização real.
