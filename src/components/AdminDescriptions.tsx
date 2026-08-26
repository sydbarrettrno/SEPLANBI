import type { CardDescriptionMap } from "../types";

interface AdminDescriptionsProps {
  descriptions: CardDescriptionMap;
  defaults: CardDescriptionMap;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
}

const LABELS: Record<string, string> = {
  received: "Processos recebidos",
  concluded: "Processos concluídos",
  balance: "Saldo do período",
  stock: "Estoque pendente",
  time: "Tempo médio",
};

export function AdminDescriptions({ descriptions, defaults, onChange, onReset }: AdminDescriptionsProps) {
  return (
    <section className="admin-page">
      <div className="page-hero simple-hero">
        <div>
          <span className="eyebrow">PAINEL ADMINISTRATIVO · PRIMEIRA VERSÃO</span>
          <h1>Editar a leitura dos cards</h1>
          <p>Os textos ajudam a interpretar os números. Fórmulas, valores e regras dos indicadores não podem ser alterados aqui.</p>
        </div>
        <span className="prototype-pill">Rascunho local neste navegador</span>
      </div>
      <div className="admin-grid">
        <form className="panel admin-form" onSubmit={(event) => event.preventDefault()}>
          <div className="panel-heading"><div><span className="eyebrow">TEXTOS AUTORIZADOS</span><h2>Descrições dos cinco sinais</h2></div></div>
          {Object.keys(defaults).map((key) => (
            <label key={key}>
              <span>{LABELS[key] ?? key}</span>
              <textarea value={descriptions[key] ?? ""} maxLength={180} onChange={(e) => onChange(key, e.target.value)} />
              <small>{(descriptions[key] ?? "").length}/180</small>
            </label>
          ))}
          <div className="admin-actions"><button className="ghost-button" type="button" onClick={onReset}>Restaurar textos padrão</button><span>Alterações salvas automaticamente.</span></div>
        </form>
        <aside className="panel admin-boundary">
          <span className="eyebrow">LIMITE DE SEGURANÇA</span>
          <h2>O que esta versão não faz</h2>
          <ul>
            <li>não altera fórmulas ou resultados;</li>
            <li>não grava no servidor;</li>
            <li>não possui usuários ou permissões;</li>
            <li>não publica textos para outros navegadores.</li>
          </ul>
          <p>A persistência central será implementada junto com autenticação, histórico e rollback. Até lá, esta tela é um protótipo funcional e explicitamente local.</p>
        </aside>
      </div>
    </section>
  );
}
