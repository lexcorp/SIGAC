import type { AgendaImportSummary, ImportOutcome } from '../types/agenda.types';

function outcomeLabel(outcome: ImportOutcome): string {
  switch (outcome) {
    case 'IMPORTED': return 'Agenda actualizada';
    case 'ALREADY_IMPORTED': return 'Ya estaba actualizada';
    case 'RECONCILED': return 'Agenda reconciliada';
  }
}

interface Props {
  readonly loading?: boolean;
  readonly error?: Error | null;
  readonly items: readonly AgendaImportSummary[];
  readonly nextCursor: string | null;
  readonly loadingMore?: boolean;
  readonly onLoadMore: () => void;
  readonly onSelect: (importacionId: string) => void;
}

export function ImportHistory({
  loading,
  error,
  items,
  nextCursor,
  loadingMore,
  onLoadMore,
  onSelect,
}: Props) {
  return (
    <section className="import-history" aria-label="Historial de importaciones">
      {loading && (
        <div className="skeleton" aria-busy="true">
          Cargando historial…
        </div>
      )}
      {error && (
        <p role="alert" className="problem-banner">
          No fue posible cargar el historial.
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="empty-state">No hay importaciones registradas para esta fecha.</div>
      )}
      <ul aria-label="Importaciones">
        {items.map((item) => (
          <li key={item.importacionId} className="import-history-item">
            <span className="import-date">
              {new Date(item.importedAt).toLocaleDateString('es-MX', {
                day: '2-digit',
                month: 'short',
              })}
              {' · '}
              {new Date(item.importedAt).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="import-outcome">{outcomeLabel(item.outcome)}</span>
            <span className="import-metrics">
              Recibidos {item.metrics.receivedRecords} · Incidencias {item.metrics.incidents}
            </span>
            <button
              type="button"
              onClick={() => onSelect(item.importacionId)}
              aria-label={`Ver detalle de importación del ${item.importedAt}`}
            >
              Detalle
            </button>
          </li>
        ))}
      </ul>
      {nextCursor && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          aria-label="Cargar más importaciones"
        >
          {loadingMore ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
    </section>
  );
}
