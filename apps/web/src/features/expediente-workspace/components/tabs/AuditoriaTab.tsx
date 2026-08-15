import type { ExpedienteAuditEntrySummary } from '../../types/expediente.types';
import { TabState } from './TabState';

export function AuditoriaTab(props: { readonly items: readonly ExpedienteAuditEntrySummary[]; readonly loading?: boolean; readonly error?: boolean; readonly nextCursor: string | null; readonly loadingMore?: boolean; readonly onLoadMore: () => void }) {
  return <TabState loading={props.loading} error={props.error} empty={!props.items.length} emptyMessage="No hay registros de auditoría.">
    <section><ul>{props.items.map((item) => <li key={item.auditId}><strong>{item.action}</strong> — {item.result} — {item.actorRef} — <time dateTime={item.occurredAt}>{item.occurredAt}</time> — {item.source}</li>)}</ul>{props.nextCursor ? <button disabled={props.loadingMore} onClick={props.onLoadMore}>Cargar más auditoría</button> : null}</section>
  </TabState>;
}
