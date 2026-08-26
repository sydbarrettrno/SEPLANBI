import { formatNumber } from "../format";
import type { NamedValue } from "../types";

interface BarListProps {
  data: NamedValue[];
  tone?: "blue" | "orange" | "red" | "teal";
  limit?: number;
}

export function BarList({ data, tone = "blue", limit = 6 }: BarListProps) {
  const visible = data.slice(0, limit);
  const max = Math.max(1, ...visible.map((item) => item.value));
  return (
    <div className={`bar-list bar-${tone}`}>
      {visible.map((item) => (
        <div className="bar-row" key={item.name}>
          <div className="bar-label"><span>{item.name}</span><strong>{formatNumber(item.value)}</strong></div>
          <div className="bar-track"><i style={{ width: `${(item.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
