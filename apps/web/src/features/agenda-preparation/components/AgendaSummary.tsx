import type { AgendaDayReadModel, ImportOutcome } from '../types/agenda.types';

interface Props {
  readonly loading?: boolean;
  readonly data?: AgendaDayReadModel;
  readonly error?: unknown;
}

function outcomeLabel(outcome: ImportOutcome): string {
  switch (outcome) {
    case 'IMPORTED': return 'Agenda actualizada';
    case 'ALREADY_IMPORTED': return 'Ya estaba actualizada';
    case 'RECONCILED': return 'Agenda reconciliada';
  }
}

export function AgendaSummary({ loading, data, error }: Props) {
  if (loading) {
    return (
      <section className="agenda-summary" aria-busy="true" aria-label="Cargando resumen de Agenda">
        <div className="skeleton">Cargando…</div>
      </section>
    );
  }
  if (error) {
    return (
      <section className="agenda-summary" role="alert" aria-label="Error al cargar Agenda">
        <p className="problem-banner">No fue posible cargar la Agenda para esta fecha.</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="agenda-summary empty-state" aria-label="Sin Agenda registrada">
        <p>No hay una Agenda registrada para esta fecha.</p>
      </section>
    );
  }
  return (
    <section className="agenda-summary" aria-label={`Agenda del ${data.agendaDate}`}>
      <h2>Agenda del {data.agendaDate}</h2>
      <p className="agenda-status">
        {outcomeLabel(data.latestOutcome)} · Actualizada{' '}
        <time dateTime={data.latestImportedAt}>
          {new Date(data.latestImportedAt).toLocaleString('es-MX')}
        </time>
      </p>
      <ul className="agenda-metrics-list" aria-label="Métricas del día">
        <li className="metric-tile">
          <span className="metric-value">{data.activeAppointments}</span>
          <span className="metric-label">citas activas</span>
        </li>
        <li className="metric-tile">
          <span className="metric-value">{data.physicians}</span>
          <span className="metric-label">médicos</span>
        </li>
        <li className="metric-tile">
          <span className="metric-value">{data.services}</span>
          <span className="metric-label">servicios</span>
        </li>
        <li className="metric-tile">
          <span className="metric-value">{data.incidentCount}</span>
          <span className="metric-label">incidencias</span>
        </li>
      </ul>
    </section>
  );
}
