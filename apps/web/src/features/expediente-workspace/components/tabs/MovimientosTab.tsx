import type { MovimientoExpedienteSummary } from '../../types/expediente.types';
import { TabState } from './TabState';

export function MovimientosTab(props: {
  readonly items: readonly MovimientoExpedienteSummary[];
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly nextCursor: string | null;
  readonly loadingMore?: boolean;
  readonly onLoadMore: () => void;
}) {
  return (
    <TabState loading={props.loading} error={props.error} empty={props.items.length === 0} emptyMessage="No hay movimientos registrados.">
      <ol className="timeline-list">
        {props.items.map((item) => (
          <li key={item.movimientoId}>
            <strong>{item.movementType}</strong>
            <time dateTime={item.occurredAt}>{item.occurredAt}</time>
            <span>{item.originLocation ?? 'Sin origen'} → {item.destinationLocation ?? 'Sin destino'}</span>
            <span>Actor: {item.actorRef}</span>
          </li>
        ))}
      </ol>
      {props.nextCursor !== null ? (
        <button type="button" disabled={props.loadingMore} onClick={props.onLoadMore}>
          {props.loadingMore ? 'Cargando…' : 'Cargar más movimientos'}
        </button>
      ) : null}
    </TabState>
  );
}
