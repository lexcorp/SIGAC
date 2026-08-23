import type { AgendaImportIncidentSummary, ImportIncident } from '../types/agenda.types';

const INCIDENT_LABELS: Record<ImportIncident, string> = {
  PHYSICIAN_NOT_RESOLVED: 'Médico no identificado',
  PHYSICIAN_AMBIGUOUS: 'Médico ambiguo',
  SERVICE_NOT_RESOLVED: 'Servicio no identificado',
  EXPEDIENT_NOT_RESOLVED: 'Expediente no identificado',
  REQUIRED_DATA_MISSING: 'Datos requeridos faltantes',
  ROW_INCONSISTENT: 'Fila inconsistente',
  DUPLICATE_FOLIO_IN_SNAPSHOT: 'FOLIO duplicado en el snapshot',
};

interface Props {
  readonly loading?: boolean;
  readonly error?: Error | null;
  readonly items: readonly AgendaImportIncidentSummary[];
  readonly nextCursor: string | null;
  readonly loadingMore?: boolean;
  readonly onLoadMore: () => void;
}

export function IncidentList({
  loading,
  error,
  items,
  nextCursor,
  loadingMore,
  onLoadMore,
}: Props) {
  return (
    <section className="incident-list" aria-label="Incidencias de importación">
      {loading && (
        <div className="skeleton" aria-busy="true">
          Cargando incidencias…
        </div>
      )}
      {error && (
        <p role="alert" className="problem-banner">
          No fue posible cargar las incidencias.
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="empty-state">No hay incidencias registradas.</div>
      )}
      {items.map((incident) => (
        <div key={incident.incidenciaId} className="incident-row">
          <span className="incident-category">[{INCIDENT_LABELS[incident.type]}]</span>
          <span className="incident-detail">
            Registro {incident.sourcePosition}
            {incident.registroId ? ` · ${incident.registroId}` : ''}
          </span>
        </div>
      ))}
      {nextCursor && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          aria-label="Cargar más incidencias"
        >
          {loadingMore ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
    </section>
  );
}
