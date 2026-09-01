import { formatDate, formatNumber, statusTone } from "../format";
import type { DashboardData } from "../types";

interface DrilldownTableProps {
  records: DashboardData["records"];
  onPage: (offset: number) => void;
  onProtocol: (protocol: string) => void;
  title?: string;
}

export function DrilldownTable({ records, onPage, onProtocol, title = "Protocolos do recorte" }: DrilldownTableProps) {
  const start = records.total ? records.offset + 1 : 0;
  const end = Math.min(records.total, records.offset + records.items.length);
  return (
    <section className="panel table-panel">
      <div className="panel-heading table-heading">
        <div><span className="eyebrow">DRILL-DOWN</span><h2>{title}</h2><p>{formatNumber(records.total)} registros · exibindo {start}–{end}</p></div>
        <div className="pager">
          <button disabled={records.offset <= 0} onClick={() => onPage(Math.max(0, records.offset - records.limit))}>← Anterior</button>
          <button disabled={records.offset + records.items.length >= records.total} onClick={() => onPage(records.offset + records.limit)}>Próxima →</button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Protocolo</th><th>Abertura</th><th>Último trâmite</th><th>Categoria</th><th>Status</th><th>Responsabilidade</th><th>Sem movimento</th></tr></thead>
          <tbody>
            {records.items.map((record) => (
              <tr key={record.protocol_id}>
                <td><button className="protocol-number protocol-link" onClick={() => onProtocol(record.protocol)}> {record.protocol}</button></td>
                <td>{formatDate(record.opened)}</td>
                <td>{formatDate(record.last_movement)}</td>
                <td><span className="category-cell">{record.category}</span></td>
                <td><span className={`status-badge ${statusTone(record.status)}`}>{record.status}</span></td>
                <td>{record.owner}</td>
                <td className={record.days_without_movement != null && record.days_without_movement > 60 ? "delay-critical" : ""}>{record.days_without_movement == null ? "—" : `${formatNumber(record.days_without_movement)} d`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.items.length === 0 ? <div className="empty-state">Nenhum protocolo encontrado neste recorte.</div> : null}
      </div>
    </section>
  );
}
