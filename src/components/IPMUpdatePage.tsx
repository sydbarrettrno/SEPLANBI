import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchIPMImportHistory,
  fetchIPMImportStatus,
  processIPMImport,
  uploadIPMBase,
  type IPMImportRun,
} from "../api";
import "../ipm-update.css";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function tone(status: string) {
  if (status === "DONE" || status === "PREPARED") return "success";
  if (status === "FAILED") return "danger";
  if (status === "REVIEW") return "warning";
  if (status === "PROCESSING") return "processing";
  return "neutral";
}

function phaseLabel(run: IPMImportRun) {
  if (run.status === "PROCESSING") return "PROCESSANDO";
  if (run.status === "REVIEW") return "REVISÃO NECESSÁRIA";
  if (run.status === "FAILED") return "FALHA";
  if (run.phase === "DIFF_COMPLETE") return "BASE COMPARADA";
  return "BASE PREPARADA";
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
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

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
    if (!run || run.phase !== "VALIDATION_COMPLETE" || attemptedProcess.current.has(run.id)) return;
    attemptedProcess.current.add(run.id);
    setProcessing(true);
    setFeedback("Base validada. Comparando automaticamente com o snapshot anterior…");
    setRun((current) => current ? {
      ...current,
      status: "PROCESSING",
      phase: "COMPARING",
      steps: current.steps.map((step) => step.id === "comparison" ? { ...step, status: "processing" } : step),
    } : current);
    processIPMImport(run.id)
      .then(async (result) => {
        setRun(result.run);
        setFeedback("Comparação concluída e histórico de movimentações registrado.");
        await loadHistory();
      })
      .catch(async (reason: unknown) => {
        setFeedback(reason instanceof Error ? reason.message : "A comparação automática foi interrompida.");
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
      setFeedback(result.duplicate
        ? "Esta mesma base já havia sido recebida. O sistema retomará a execução pendente, se houver."
        : "Base recebida e validada. A comparação será iniciada automaticamente.");
      await loadHistory();
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Não foi possível receber a base IPM.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ipm-update-page">
      <section className="page-hero simple-hero ipm-update-hero">
        <div>
          <span className="eyebrow">ATUALIZAÇÃO OPERACIONAL</span>
          <h1>Atualização da Base IPM</h1>
          <p>Envie o relatório diário. O sistema preserva o original, valida a estrutura e compara automaticamente o snapshot com a base anterior.</p>
        </div>
        <span className="live-pill"><i /> pipeline protegida</span>
      </section>

      <div className="ipm-update-grid">
        <section className="panel ipm-upload-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">NOVA BASE</span>
              <h2>Enviar relatório do IPM</h2>
              <p>O nome do arquivo enviado não precisa estar padronizado. O sistema salva como BASEIPM_DDMMAAAA.xlsx.</p>
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
              <strong>Formato interno</strong>
              <span>BASEIPM_DDMMAAAA.xlsx</span>
            </div>
            <button className="primary-button" type="button" disabled={!file || busy || processing} onClick={submit}>
              {busy ? "Recebendo e validando…" : "Enviar base e iniciar pipeline"}
            </button>
          </div>

          {feedback ? <p className="ipm-feedback" role="status">{feedback}</p> : null}
        </section>

        <aside className="panel ipm-safety-panel">
          <span className="eyebrow">PROTEÇÃO</span>
          <h2>Produção permanece isolada</h2>
          <p>A V02 executa comparação e registra eventos, mas ainda não recalcula nem publica indicadores.</p>
          <ul>
            <li>arquivo bruto armazenado de forma privada;</li>
            <li>snapshot normalizado persistido para o próximo dia;</li>
            <li>novos e alterações identificados automaticamente;</li>
            <li>publicação permanece bloqueada até os gates posteriores.</li>
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
            <div><span>Colunas reconhecidas</span><strong>{run.metrics.source_columns}</strong></div>
            <div><span>Sentinelas ignoradas</span><strong>{run.metrics.date_sentinels_ignored}</strong></div>
          </div>

          {comparison ? (
            <div className="ipm-diff-metrics" aria-label="Resultado da comparação diária">
              <div className="new"><span>Novos</span><strong>{comparison.new.toLocaleString("pt-BR")}</strong></div>
              <div className="changed"><span>Alterados</span><strong>{comparison.changed.toLocaleString("pt-BR")}</strong></div>
              <div className="same"><span>Sem alteração</span><strong>{comparison.unchanged.toLocaleString("pt-BR")}</strong></div>
              <div className={comparison.removed ? "removed alert" : "removed"}><span>Ausentes</span><strong>{comparison.removed.toLocaleString("pt-BR")}</strong></div>
            </div>
          ) : null}

          {comparison?.field_changes ? (
            <div className="ipm-event-summary">
              <span>Movimentações identificadas</span>
              <div>
                <b>{comparison.field_changes.last_movement} novo trâmite</b>
                <b>{comparison.field_changes.sector} mudança de setor</b>
                <b>{comparison.field_changes.situation} mudança de situação</b>
                <b>{comparison.field_changes.closed} alteração de encerramento</b>
              </div>
            </div>
          ) : null}

          <div className="ipm-progress-summary">
            <span>{completed} etapas concluídas · {run.phase === "DIFF_COMPLETE" ? "próxima: recálculo dos indicadores" : "próxima: comparação com a base anterior"}</span>
            <div><i style={{ width: `${(completed / run.steps.length) * 100}%` }} /></div>
          </div>

          <div className="ipm-steps">
            {run.steps.map((step, index) => (
              <div className={`ipm-step ${step.status}`} key={step.id}>
                <span className="ipm-step-index">{step.status === "done" ? "✓" : step.status === "processing" ? "…" : step.status === "blocked" ? "×" : index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.status === "done" ? "Concluída" : step.status === "processing" ? "Processando" : step.status === "blocked" ? "Bloqueada nesta versão" : "Aguardando"}</small>
                </div>
              </div>
            ))}
          </div>
          <p className="ipm-run-message">{run.message}</p>
        </section>
      ) : null}

      <section className="panel ipm-history-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">HISTÓRICO</span><h2>Bases recebidas</h2><p>Últimas execuções registradas pelo sistema.</p></div>
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
                <span className={`ipm-history-status ${tone(item.status)}`}>{item.phase === "DIFF_COMPLETE" ? "Comparada" : item.status === "PREPARED" ? "Preparada" : item.status}</span>
              </button>
            ))}
          </div>
        ) : <p className="ipm-empty">Nenhuma base diária recebida ainda.</p>}
      </section>
    </section>
  );
}
