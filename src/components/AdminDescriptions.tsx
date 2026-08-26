import { useState } from "react";
import type { CardDescriptionMap } from "../types";

interface AdminDescriptionsProps {
  descriptions: CardDescriptionMap;
  defaults: CardDescriptionMap;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  onSave: (password: string) => Promise<void>;
  persistent: boolean;
  updatedAt: string | null;
}

const LABELS: Record<string, string> = {
  received: "Processos recebidos",
  concluded: "Processos concluídos",
  balance: "Saldo do período",
  stock: "Estoque pendente",
  time: "Tempo médio",
};

export function AdminDescriptions({ descriptions, defaults, onChange, onReset, onSave, persistent, updatedAt }: AdminDescriptionsProps) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setFeedback({ tone: "error", text: "Informe a senha de gravação." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await onSave(password);
      setPassword("");
      setFeedback({ tone: "success", text: "Descrições gravadas na configuração central." });
    } catch (reason) {
      setFeedback({ tone: "error", text: reason instanceof Error ? reason.message : "Não foi possível gravar." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-page">
      <div className="page-hero simple-hero">
        <div>
          <span className="eyebrow">PAINEL ADMINISTRATIVO · CONFIGURAÇÃO CENTRAL</span>
          <h1>Editar a leitura dos cards</h1>
          <p>Os textos ajudam a interpretar os números. Fórmulas, valores e regras dos indicadores não podem ser alterados aqui.</p>
        </div>
        <span className={persistent ? "live-pill" : "prototype-pill"}>{persistent ? "Persistência ativa" : "Armazenamento pendente"}</span>
      </div>
      <div className="admin-grid">
        <form className="panel admin-form" onSubmit={submit}>
          <div className="panel-heading"><div><span className="eyebrow">TEXTOS AUTORIZADOS</span><h2>Descrições dos cinco sinais</h2></div></div>
          {Object.keys(defaults).map((key) => (
            <label key={key}>
              <span>{LABELS[key] ?? key}</span>
              <textarea value={descriptions[key] ?? ""} maxLength={180} onChange={(e) => onChange(key, e.target.value)} />
              <small>{(descriptions[key] ?? "").length}/180</small>
            </label>
          ))}
          <div className="admin-password-row">
            <label>
              <span>Senha de gravação</span>
              <input type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} placeholder="Informe a senha para publicar" />
            </label>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? "Gravando…" : "Gravar na base"}</button>
          </div>
          {feedback ? <p className={`admin-feedback ${feedback.tone}`} role="status">{feedback.text}</p> : null}
          <div className="admin-actions">
            <button className="ghost-button" type="button" onClick={onReset}>Restaurar textos padrão</button>
            <span>{updatedAt ? `Última gravação: ${new Date(updatedAt).toLocaleString("pt-BR")}` : "Nenhuma alteração central registrada."}</span>
          </div>
        </form>
        <aside className="panel admin-boundary">
          <span className="eyebrow">LIMITE DE SEGURANÇA</span>
          <h2>Proteções da edição</h2>
          <ul>
            <li>não altera fórmulas ou resultados;</li>
            <li>a leitura permanece pública, mas a gravação exige senha;</li>
            <li>a senha fica somente no ambiente protegido do servidor;</li>
            <li>as últimas 20 gravações permanecem no histórico técnico;</li>
            <li>cinco erros de senha bloqueiam novas tentativas por dez minutos.</li>
          </ul>
          <p>Ao gravar, os novos textos passam a valer para todos os navegadores. A base operacional de protocolos e a classificação semântica permanecem imutáveis.</p>
        </aside>
      </div>
    </section>
  );
}
