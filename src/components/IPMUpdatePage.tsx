import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchIPMImportHistory,
  fetchIPMImportStatus,
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

export function IPMUpdatePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [run, setRun] = useState<IPMImportRun | null>(null);
  const [history, setHistory] = useState<IPMImportRun[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
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
    if (!run || run.status !== "PROCESSING") return;
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
  }, [run?.id, run?.status]);

  const completed = useMemo(
    () => run?.steps.filter((step) => step.status === "done").length ?? 0,
    [run],
  );

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
        ? "Esta mesma base já havia sido recebida. Nenhum arquivo foi duplicado."
        : "Base recebida e validada. O arquivo original foi preservado no armazenamento privado.");
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
          <p>Envie o relatório diário. O sistema padroniza o nome, preserva o arquivo original e registra cada etapa antes de qualquer alteração no BI.</p>
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
            <button className="primary-button" type="button" disabled={!file || busy} onClick={submit}>
              {busy ? "Recebendo e validando…" : "Enviar base e iniciar pipeline"}
            </button>
          </div>

          {feedback ? <p className="ipm-feedback" role="status">{feedback}</p> : null}
        </section>

        <aside className="panel ipm-safety-panel">
          <span className="eyebrow">PROTEÇÃO</span>
          <h2>Produção permanece isolada</h2>
          <p>Nesta etapa o arquivo é recebido, armazenado e validado. Nenhum indicador ou dado público é alterado automaticamente.</p>
          <ul>
            <li>arquivo bruto armazenado de forma privada;</li>
            <li>duplicidades e datas inconsistentes bloqueiam o fluxo;</li>
            <li>uma base diferente para o mesmo dia não sobrescreve a anterior;</li>
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
            <span className={`ipm-status-pill ${tone(run.status)}`}>{run.status === "PREPARED" ? "BASE PREPARADA" : run.status}</span>
          </div>

          <div className="ipm-run-metrics">
            <div><span>Protocolos</span><strong>{run.metrics.unique_protocols.toLocaleString("pt-BR")}</strong></div>
            <div><span>Duplicidades</span><strong>{run.metrics.duplicates}</strong></div>
            <div><span>Colunas reconhecidas</span><strong>{run.metrics.source_columns}</strong></div>
            <div><span>Sentinelas ignoradas</span><strong>{run.metrics.date_sentinels_ignored}</strong></div>
          </div>

          <div className="ipm-progress-summary">
            <span>{completed} de {run.steps.length} etapas concluídas</span>
            <div><i style={{ width: `${(completed / run.steps.length) * 100}%` }} /></div>
          </div>

          <div className="ipm-steps">
            {run.steps.map((step, index) => (
              <div className={`ipm-step ${step.status}`} key={step.id}>
                <span className="ipm-step-index">{step.status === "done" ? "✓" : step.status === "blocked" ? "×" : index + 1}</span>
                <div><strong>{step.label}</strong><small>{step.status === "done" ? "Concluída" : step.status === "blocked" ? "Bloqueada nesta versão" : "Aguardando"}</small></div>
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
              <button className="ipm-history-row" type="button" key={item.id} onClick={() => setRun(item)}>
                <strong>{item.canonical_name}</strong>
                <span>{formatDate(item.local_created_at)}</span>
                <span>{item.metrics.unique_protocols.toLocaleString("pt-BR")}</span>
                <span className={`ipm-history-status ${tone(item.status)}`}>{item.status === "PREPARED" ? "Preparada" : item.status}</span>
              </button>
            ))}
          </div>
        ) : <p className="ipm-empty">Nenhuma base diária recebida ainda.</p>}
      </section>
    </section>
  );
}
