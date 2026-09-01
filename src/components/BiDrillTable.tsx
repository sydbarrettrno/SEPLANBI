import { formatDate, formatNumber, statusTone } from "../format";

type PublicRecord = Record<string, string | number | null>;

interface BiDrillTableProps {
  total: number;
  items: PublicRecord[];
  offset: number;
  limit: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  onPage: (offset: number) => void;
  onSort: (field: string) => void;
  onProtocol: (protocol: string) => void;
  exportHref?: string;
  privateDetail?: boolean;
}

const COLUMNS = [
  ["protocol", "Protocolo"],
  ["opened", "Abertura"],
  ["category", "Categoria"],
  ["status", "Status"],
  ["days_without_movement", "Dias"],
  ["sector", "Setor"],
  ["last_movement", "Último trâmite"],
] as const;

export function BiDrillTable({ total, items, offset, limit, sortBy, sortDir, onPage, onSort, onProtocol }: BiDrillTableProps) {
  const start = total ? offset + 1 : 0;
  const end = Math.min(total, offset + items.length);
  return (
    <section className="panel bi-detail-table" aria-label="Tabela dinâmica dos protocolos selecionados">
      <div className="panel-heading table-heading">
        <div>
          <span className="eyebrow">DRILL-DOWN</span>
          <h2 data-record-count={total}>{formatNumber(total)} registros encontrados</h2>
          <p>Exibindo {start}–{end}. Refine os filtros para investigar o conjunto desejado.</p>
        </div>
        <div className="pager">
          <button disabled={offset <= 0} onClick={() => onPage(Math.max(0, offset - limit))}>← Anterior</button>
          <button disabled={offset + items.length >= total} onClick={() => onPage(offset + limit)}>Próxima →</button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr>{COLUMNS.map(([field, label]) => (
            <th key={field}><button type="button" onClick={() => onSort(field)}>{label}{sortBy === field ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</button></th>
          ))}</tr></thead>
          <tbody>{items.map((record) => (
            <tr key={String(record.protocol)}>
              <td><button className="protocol-number protocol-link" onClick={() => onProtocol(String(record.protocol))}>{String(record.protocol)}</button></td>
              <td>{formatDate(String(record.opened || ""))}</td>
              <td><span className="category-cell">{String(record.category || "—")}</span></td>
              <td><span className={`status-badge ${statusTone(String(record.status || ""))}`}>{String(record.status || "—")}</span></td>
              <td className={Number(record.days_without_movement) > 60 ? "delay-critical" : ""}>{record.days_without_movement == null ? "—" : `${formatNumber(Number(record.days_without_movement))} d`}</td>
              <td>{String(record.sector || "—")}</td>
              <td>{formatDate(String(record.last_movement || ""))}</td>
            </tr>
          ))}</tbody>
        </table>
        {!items.length ? <div className="empty-state">Nenhum protocolo forma este cruzamento.</div> : null}
      </div>
    </section>
  );
}
