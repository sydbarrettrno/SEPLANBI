import { useEffect, useState } from "react";
import { authenticateAdmin } from "../api";
import "../admin-gate.css";

interface AdminAccessGateProps {
  authorized: boolean;
  checking: boolean;
  autoOpen?: boolean;
  onAuthenticated: () => void;
  onOpenAdmin: () => void;
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.14 12.94a7.44 7.44 0 0 0 .05-.94 7.44 7.44 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94L14.38 2.8a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.52a7.2 7.2 0 0 0-1.63.94L5.16 5.3a.5.5 0 0 0-.61.22L2.63 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.44 7.44 0 0 0-.05.94c0 .32.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .61.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.52a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.52a7.2 7.2 0 0 0 1.63-.94l2.39.96a.5.5 0 0 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
    </svg>
  );
}

export function AdminAccessGate({ authorized, checking, autoOpen = false, onAuthenticated, onOpenAdmin }: AdminAccessGateProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (autoOpen && !checking && !authorized) setOpen(true);
  }, [autoOpen, authorized, checking]);

  const activate = () => {
    if (checking) return;
    if (authorized) {
      onOpenAdmin();
      return;
    }
    setError("");
    setOpen(true);
  };

  const close = () => {
    if (submitting) return;
    setPassword("");
    setError("");
    setOpen(false);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setError("Informe a senha administrativa.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await authenticateAdmin(password);
      if (!result.authorized) throw new Error("Acesso administrativo não autorizado.");
      setPassword("");
      setOpen(false);
      onAuthenticated();
      onOpenAdmin();
    } catch (reason) {
      setPassword("");
      setError(reason instanceof Error ? reason.message : "Não foi possível validar o acesso.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`admin-gear ${authorized ? "is-authorized" : ""}`}
        aria-label="Acesso administrativo"
        title="Acesso administrativo"
        onClick={activate}
        disabled={checking}
      >
        <GearIcon />
      </button>

      {open ? (
        <div className="admin-gate-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section className="admin-gate-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-gate-title">
            <button type="button" className="admin-gate-close" aria-label="Fechar" onClick={close}>×</button>
            <div className="admin-gate-symbol"><GearIcon /></div>
            <span className="eyebrow">ACESSO RESTRITO</span>
            <h2 id="admin-gate-title">Administração do conteúdo</h2>
            <p>A senha é validada somente no servidor. Ela não é gravada no navegador nem faz parte do código público.</p>
            <form onSubmit={submit}>
              <label>
                <span>Senha administrativa</span>
                <input
                  autoFocus
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Informe a senha"
                />
              </label>
              {error ? <p className="admin-gate-error" role="alert">{error}</p> : null}
              <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Validando…" : "Entrar"}</button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
