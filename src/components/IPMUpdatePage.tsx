import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  approveIPMImport,
  fetchIPMImportHistory,
  fetchIPMImportStatus,
  fetchIPMReviewRows,
  processIPMImport,
  rejectIPMImport,
  uploadIPMBase,
  type IPMImportRun,
  type IPMReviewRow,
} from "../api";
import "../ipm-update.css";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function tone(status: string) {
  if (status === "DONE" || status === "PREPARED") return "success";
  if (status === "FAILED" || status === "REJECTED") return "danger";
  if (status === "REVIEW") return "warning";
  if (status === "PROCESSING") return "processing";
  return "neutral";
}

function phaseLabel(run: IPMImportRun) {
  if (run.status === "PROCESSING") return "PROCESSANDO";
  if (run.status === "REVIEW") return "AGUARDANDO SUA VALIDAÇÃO";
  if (run.status === "DONE") return "BASE APROVADA";
  if (run.status === "REJECTED") return "BASE REJEITADA";
  if (run.status === "FAILED") return "FALHA";
  return "BASE PREPARADA";
}

// Ativar somente após o worker agendado ter passado no gate de produção.
const automaticWorkerEnabled = import.meta.env.VITE_IPM_AUTO_WORKER_ENABLED === "true";

const fieldLabels: Record<string, string> = {
  opened_at: "Abertura",
  last_movement_at: "Último trâmite",
  closed_at: "Encerramento",
  source_status: "Situação",
  subject: "Assunto",
  current_sector: "Setor",
  o: "Abertura",
  m: "Último trâmite",
  c: "Encerramento",
  s: "Situação",
  u: "Assunto",
  r: "Setor",
};

function compactValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "vazio";
  const text = String(value);
  return text.length > 42 ? `${text.slice(0, 39)}…` : text;
}

function DiffDetails({ row }: { row: IPMReviewRow }) {
  const entries = Object.entries(row.diff_fields || {});
  if (row.diff_status === "new") return <span className="ipm-new-record">Novo protocolo</span>;
  if (!entries.length) return <span className="ipm-no-diff">—</span>;
  return (
    <div className="ipm-diff-detail">
      {entries.slice(0, 3).map(([field, change]) => (
        <span key={field}>
          <b>{fieldLabels[field] || field}</b>
          <em>{compactValue(change?.before)} → {compactValue(change?.after)}</em>
        </span>
      ))}
      {entries.length > 3 ? <small>+{entries.length - 3} alteração(ões)</small> : null}
    </div>
  );
}

export function IPMUpdatePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const attemptedProcess = useRef<Set<string>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [run, setRun] = useState<IPMImportRun | null>(null);
  const [history, setHistory] = useState<IPMImportRun[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [reviewRows, setReviewRows] = useState<IPMReviewRow[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewDiff, setReviewDiff] = useState("");
  const [reviewQuery, setReviewQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [reviewOffset, setReviewOffset] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);
  const reviewLimit = 100;

  const loadHistory = async () => {
    try {
      const result = await fetchIPMImportHistory();
      setHistory(result.runs);
      if (!run && result.runs.length) setRun(result.runs[0]!);
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Não foi possível carregar o histórico.");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    if (automaticWorkerEnabled) return;
    if (!run || run.phase !== "VALIDATION_COMPLETE" || attemptedProcess.current.has(run.id)) return;
    attemptedProcess.current.add(run.id);
    setProcessing(true);
    setFeedback("Arquivo salvo no Supabase. Carregando staging e executando os gates de validação…");
    setRun((current) => current ? {
      ...current,
      status: "PROCESSING",
      phase: "COMPARING",
      steps: current.steps.map((step) =>
        step.id === "snapshot" || step.id === "comparison"
          ? { ...step, status: "processing" }
          : step
      ),
    } : current);

    processIPMImport(run.id)
      .then(async (result) => {
        setRun(result.run);
        setFeedback(
          result.run.status === "REVIEW"
            ? "Validação automática concluída. Confira os registros abaixo antes de aprovar a base."
            : result.run.message,
        );
        await loadHistory();
      })
      .catch(async (reason: unknown) => {
        setFeedback(reason instanceof Error ? reason.message : "A validação automática foi interrompida.");
        try {
          const result = await fetchIPMImportStatus(run.id);
          setRun(result.run);
        } catch {
          // Mantém o último estado conhecido.
        }
      })
      .finally(() => setProcessing(false));
  }, [run?.id, run?.phase]);

  useEffect(() => {
    if (!run || run.status !== "PROCESSING" || processing) return;
    const timer = window.setInterval(async () => {
      try {
        const result = await fetchIPMImportStatus(run.id);
        setRun(result.run);
        if (result.run.status !== "PROCESSING") void loadHistory();
      } catch {
        // Mantém a última posição conhecida e tenta novamente no próximo ciclo.
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [run?.id, run?.status, processing]);

  useEffect(() => {
    if (!run || !["REVIEW", "DONE"].includes(run.status)) {
      setReviewRows([]);
      setReviewTotal(0);
      return;
    }
    const comparison = run.metrics.comparison;
    setReviewDiff(
      comparison?.changed ? "changed"
        : comparison?.new ? "new"
          : "",
    );
    setReviewOffset(0);
    setReviewQuery("");
    setAppliedQuery("");
  }, [run?.id]);

  useEffect(() => {
    if (!run || !["REVIEW", "DONE"].includes(run.status)) return;
    let active = true;
    setReviewLoading(true);
    void fetchIPMReviewRows(run.id, {
      diff: reviewDiff,
      q: appliedQuery,
      limit: reviewLimit,
      offset: reviewOffset,
    })
      .then((result) => {
        if (!active) return;
        setReviewRows(result.rows);
        setReviewTotal(result.total);
      })
      .catch((reason) => {
        if (!active) return;
        setFeedback(reason instanceof Error ? reason.message : "Não foi possível abrir os registros para conferência.");
      })
      .finally(() => {
        if (active) setReviewLoading(false);
      });
    return () => { active = false; };
  }, [run?.id, run?.status, reviewDiff, appliedQuery, reviewOffset]);

  const completed = useMemo(
    () => run?.steps.filter((step) => step.status === "done").length ?? 0,
    [run],
  );

  const comparison = run?.metrics.comparison;

  const choose = (candidate: File | null) => {
    setFeedback(null);
    if (!candidate) {
      setFile(null);
      return;
    }
    if (!candidate.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setFeedback("Selecione o relatório IPM em formato XLSX.");
      return;
    }
    setFile(candidate);
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await uploadIPMBase(file);
      setRun(result.run);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setFeedback(automaticWorkerEnabled
        ? "Arquivo armazenado. A pipeline continuará mesmo se você fechar esta página."
        : "Arquivo original armazenado no Supabase. A validação será iniciada nesta sessão.");
      await loadHistory();
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Não foi possível receber a base IPM.");
    } finally {
      setBusy(false);
    }
  };

  const submitReviewSearch = (event: FormEvent) => {
    event.preventDefault();
    setReviewOffset(0);
    setAppliedQuery(reviewQuery.trim());
  };

  const approve = async () => {
    if (!run || !run.can_approve || decisionBusy) return;
    if (!window.confirm("Aprovar esta base como fonte oficial do próximo estágio? O BI ainda não será publicado.")) return;
    setDecisionBusy(true);
    setFeedback(null);
    try {
      const result = await approveIPMImport(run.id);
      setRun(result.run);
      setFeedback("Base aprovada e registrada no PostgreSQL. Indicadores e publicação continuam bloqueados.");
      await loadHistory();
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Não foi possível aprovar a base.");
    } finally {
      setDecisionBusy(false);
    }
  };

  const reject = async () => {
    if (!run || decisionBusy) return;
    if (!window.confirm("Rejeitar esta base? Ela permanecerá no histórico, mas não será promovida para a base oficial.")) return;
    setDecisionBusy(true);
    setFeedback(null);
    try {
      const result = await rejectIPMImport(run.id, "Rejeitada manualmente durante a validação da base.");
      setRun(result.run);
      setFeedback("Base rejeitada. Nenhum dado foi promovido para a base oficial.");
      await loadHistory();
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Não foi possível rejeitar a base.");
    } finally {
      setDecisionBusy(false);
    }
  };

  const nextLabel =
    run?.phase === "AWAITING_APPROVAL" ? "próxima: sua validação e aprovação"
      : run?.phase === "APPROVED" ? "próxima: recálculo dos indicadores"
        : "próxima: validação automática";

  return (
    <section className="ipm-update-page">
      <section className="page-hero simple-hero ipm-update-hero">
        <div>
          <span className="eyebrow">ATUALIZAÇÃO OPERACIONAL</span>
          <h1>Atualização da Base IPM</h1>
          <p>O relatório é arquivado no Supabase, carregado em staging e só pode virar base oficial depois da sua validação.</p>
        </div>
        <span className="live-pill"><i /> Supabase protegido</span>
      </section>

      <div className="ipm-update-grid">
        <section className="panel ipm-upload-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">NOVA BASE</span>
              <h2>Enviar relatório do IPM</h2>
              <p>Você pode enviar o relatório com o nome original. A data interna do arquivo define o nome BASEIPM_DDMMAAAA.xlsx.</p>
            </div>
          </div>

          <button
            type="button"
            className={`ipm-dropzone ${dragging ? "is-dragging" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              choose(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <span className="ipm-upload-icon" aria-hidden="true">⇧</span>
            <strong>{file ? file.name : "Arraste a planilha aqui"}</strong>
            <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "ou clique para selecionar o arquivo XLSX"}</small>
          </button>
          <input
            ref={inputRef}
            className="ipm-file-input"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
          />

          <div className="ipm-upload-actions">
            <div>
              <strong>Destino</strong>
              <span>Supabase Storage + PostgreSQL staging</span>
            </div>
            <button className="primary-button" type="button" disabled={!file || busy || processing} onClick={submit}>
              {busy ? "Recebendo e armazenando…" : "Enviar base e iniciar validação"}
            </button>
          </div>

          {feedback ? <p className="ipm-feedback" role="status">{feedback}</p> : null}
        </section>

        <aside className="panel ipm-safety-panel">
          <span className="eyebrow">PROTEÇÃO</span>
          <h2>Nada entra direto no BI</h2>
          <p>A planilha recebida fica separada da base oficial até concluir os gates automáticos e a sua conferência.</p>
          <ul>
            <li>XLSX original em bucket privado do Supabase;</li>
            <li>dados recebidos primeiro em staging;</li>
            <li>comparação antes × depois por protocolo;</li>
            <li>aprovação humana obrigatória;</li>
            <li>indicadores e publicação ainda bloqueados.</li>
          </ul>
        </aside>
      </div>

      {run ? (
        <section className="panel ipm-run-panel">
          <div className="ipm-run-heading">
            <div>
              <span className="eyebrow">EXECUÇÃO ATUAL</span>
              <h2>{run.canonical_name}</h2>
              <p>Recebida em {formatDate(run.local_created_at)} · corte encontrado: {run.metrics.latest_movement || "—"}</p>
            </div>
            <span className={`ipm-status-pill ${tone(run.status)}`}>{phaseLabel(run)}</span>
          </div>

          <div className="ipm-run-metrics">
            <div><span>Protocolos</span><strong>{run.metrics.unique_protocols.toLocaleString("pt-BR")}</strong></div>
            <div><span>Duplicidades</span><strong>{run.metrics.duplicates}</strong></div>
            <div><span>Erros</span><strong>{(run.metrics.errors ?? 0).toLocaleString("pt-BR")}</strong></div>
            <div><span>Avisos</span><strong>{(run.metrics.warnings ?? 0).toLocaleString("pt-BR")}</strong></div>
          </div>

          {comparison ? (
            <div className="ipm-diff-metrics" aria-label="Resultado da comparação diária">
              <div className="new"><span>Novos</span><strong>{comparison.new.toLocaleString("pt-BR")}</strong></div>
              <div className="changed"><span>Alterados</span><strong>{comparison.changed.toLocaleString("pt-BR")}</strong></div>
              <div className="same"><span>Sem alteração</span><strong>{comparison.unchanged.toLocaleString("pt-BR")}</strong></div>
              <div className={comparison.removed ? "removed alert" : "removed"}><span>Ausentes</span><strong>{comparison.removed.toLocaleString("pt-BR")}</strong></div>
            </div>
          ) : null}

          {run.issues?.length ? (
            <div className="ipm-issues">
              {run.issues.map((issue, index) => (
                <div className={`ipm-issue ${issue.severity}`} key={`${issue.issue_code}-${issue.protocol_id || index}`}>
                  <strong>{issue.severity === "error" ? "Erro" : "Aviso"} · {issue.issue_code}</strong>
                  <span>{issue.issue_message}{issue.protocol_id ? ` — ${issue.protocol_id}` : ""}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="ipm-progress-summary">
            <span>{completed} etapas concluídas · {nextLabel}</span>
            <div><i style={{ width: `${(completed / run.steps.length) * 100}%` }} /></div>
          </div>

          <div className="ipm-steps">
            {run.steps.map((step, index) => (
              <div className={`ipm-step ${step.status}`} key={step.id}>
                <span className="ipm-step-index">{step.status === "done" ? "✓" : step.status === "processing" ? "…" : step.status === "blocked" ? "×" : index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.status === "done" ? "Concluída" : step.status === "processing" ? "Processando" : step.status === "blocked" ? "Bloqueada" : "Aguardando"}</small>
                </div>
              </div>
            ))}
          </div>
          <p className="ipm-run-message">{run.message}</p>
        </section>
      ) : null}

      {run && ["REVIEW", "DONE"].includes(run.status) ? (
        <section className="panel ipm-review-panel">
          <div className="panel-heading ipm-review-heading">
            <div>
              <span className="eyebrow">VALIDAÇÃO HUMANA</span>
              <h2>Conferir a base antes de aprovar</h2>
              <p>Use os filtros para inspecionar os protocolos e as diferenças encontradas pelo sistema.</p>
            </div>
            <strong className="ipm-review-count">{reviewTotal.toLocaleString("pt-BR")} registro(s)</strong>
          </div>

          <div className="ipm-review-toolbar">
            <div className="ipm-review-filters">
              {[
                ["changed", `Alterados (${comparison?.changed ?? 0})`],
                ["new", `Novos (${comparison?.new ?? 0})`],
                ["unchanged", `Sem alteração (${comparison?.unchanged ?? 0})`],
                ["", "Todos"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  className={reviewDiff === value ? "active" : ""}
                  key={value || "all"}
                  onClick={() => { setReviewDiff(value); setReviewOffset(0); }}
                >
                  {label}
                </button>
              ))}
            </div>
            <form className="ipm-review-search" onSubmit={submitReviewSearch}>
              <input
                value={reviewQuery}
                onChange={(event) => setReviewQuery(event.target.value)}
                placeholder="Protocolo, assunto, setor ou situação"
              />
              <button type="submit">Buscar</button>
            </form>
          </div>

          <div className="ipm-review-table">
            <div className="ipm-review-row header">
              <span>Protocolo</span>
              <span>Resultado</span>
              <span>Situação / assunto</span>
              <span>Setor</span>
              <span>Último trâmite</span>
              <span>Antes → depois</span>
            </div>
            {reviewLoading ? (
              <p className="ipm-empty">Carregando registros para conferência…</p>
            ) : reviewRows.length ? reviewRows.map((row) => (
              <div className="ipm-review-row" key={row.protocol_id}>
                <strong>{row.protocol_id}</strong>
                <span className={`ipm-diff-badge ${row.diff_status}`}>
                  {row.diff_status === "changed" ? "Alterado" : row.diff_status === "new" ? "Novo" : "Sem alteração"}
                </span>
                <span><b>{row.source_status || "—"}</b><small>{row.subject || "—"}</small></span>
                <span>{row.current_sector || "—"}</span>
                <span>{formatDate(row.last_movement_at)}</span>
                <DiffDetails row={row} />
              </div>
            )) : (
              <p className="ipm-empty">Nenhum registro encontrado para este filtro.</p>
            )}
          </div>

          <div className="ipm-review-footer">
            <div className="ipm-pagination">
              <button
                type="button"
                disabled={reviewOffset === 0 || reviewLoading}
                onClick={() => setReviewOffset(Math.max(0, reviewOffset - reviewLimit))}
              >
                Anterior
              </button>
              <span>{reviewTotal ? `${reviewOffset + 1}–${Math.min(reviewOffset + reviewLimit, reviewTotal)} de ${reviewTotal}` : "0 registros"}</span>
              <button
                type="button"
                disabled={reviewOffset + reviewLimit >= reviewTotal || reviewLoading}
                onClick={() => setReviewOffset(reviewOffset + reviewLimit)}
              >
                Próxima
              </button>
            </div>

            {run.status === "REVIEW" ? (
              <div className="ipm-decision-actions">
                <button className="ipm-reject-button" type="button" disabled={decisionBusy} onClick={reject}>
                  Rejeitar base
                </button>
                <button className="primary-button" type="button" disabled={!run.can_approve || decisionBusy} onClick={approve}>
                  {decisionBusy ? "Registrando decisão…" : "Aprovar base"}
                </button>
              </div>
            ) : (
              <span className="ipm-approved-note">✓ Base já aprovada</span>
            )}
          </div>
        </section>
      ) : null}

      <section className="panel ipm-history-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">HISTÓRICO</span><h2>Bases recebidas</h2><p>Últimas execuções registradas no PostgreSQL do Supabase.</p></div>
          <button className="ghost-button" type="button" onClick={() => { setLoadingHistory(true); void loadHistory(); }}>Atualizar</button>
        </div>
        {loadingHistory ? <p className="ipm-empty">Carregando histórico…</p> : history.length ? (
          <div className="ipm-history-table">
            <div className="ipm-history-row header"><span>Base</span><span>Recebida</span><span>Protocolos</span><span>Status</span></div>
            {history.map((item) => (
              <button className="ipm-history-row" type="button" key={item.id} onClick={async () => {
                try {
                  const result = await fetchIPMImportStatus(item.id);
                  setRun(result.run);
                } catch {
                  setRun(item);
                }
              }}>
                <strong>{item.canonical_name}</strong>
                <span>{formatDate(item.local_created_at)}</span>
                <span>{item.metrics.unique_protocols.toLocaleString("pt-BR")}</span>
                <span className={`ipm-history-status ${tone(item.status)}`}>{phaseLabel(item)}</span>
              </button>
            ))}
          </div>
        ) : <p className="ipm-empty">Nenhuma base recebida no Supabase ainda.</p>}
      </section>
    </section>
  );
}
