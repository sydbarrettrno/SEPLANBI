interface KpiCardProps {
  eyebrow: string;
  value: string;
  description: string;
  detail: string;
  tone: "blue" | "green" | "orange" | "purple" | "red";
  trend?: string;
  onClick?: () => void;
}

export function KpiCard({ eyebrow, value, description, detail, tone, trend, onClick }: KpiCardProps) {
  return (
    <button className={`kpi-card tone-${tone}`} onClick={onClick} type="button">
      <span className="kpi-accent" />
      <div className="kpi-topline">
        <span>{eyebrow}</span>
        {trend ? <small>{trend}</small> : null}
      </div>
      <strong>{value}</strong>
      <p>{description}</p>
      <footer>
        <span>{detail}</span>
        <i aria-hidden="true">→</i>
      </footer>
    </button>
  );
}
