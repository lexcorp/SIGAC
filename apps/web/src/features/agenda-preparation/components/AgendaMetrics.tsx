import type { AgendaImportMetrics, ImportOutcome } from '../types/agenda.types';

interface Props {
  readonly outcome: ImportOutcome;
  readonly metrics: AgendaImportMetrics;
}

export function AgendaMetrics({ outcome, metrics }: Props) {
  return (
    <section className="agenda-import-metrics" aria-label="Métricas de importación">
      <p className="import-outcome">
        {outcome === 'IMPORTED' && 'Agenda actualizada'}
        {outcome === 'ALREADY_IMPORTED' && 'Ya estaba actualizada'}
        {outcome === 'RECONCILED' && 'Agenda reconciliada'}
      </p>
      <dl className="metrics-grid">
        <div><dt>Recibidos</dt><dd>{metrics.receivedRecords}</dd></div>
        <div><dt>Procesados</dt><dd>{metrics.processed}</dd></div>
        <div><dt>Nuevas</dt><dd>{metrics.added}</dd></div>
        <div><dt>Actualizadas</dt><dd>{metrics.updated}</dd></div>
        <div><dt>Sin cambios</dt><dd>{metrics.unchanged}</dd></div>
        <div><dt>Restauradas</dt><dd>{metrics.restored}</dd></div>
        <div><dt>Pendientes revisión</dt><dd>{metrics.pendingReview}</dd></div>
        <div><dt>Rechazadas</dt><dd>{metrics.rejected}</dd></div>
        <div><dt>FOLIO duplicado</dt><dd>{metrics.duplicateFolio}</dd></div>
        <div><dt>Retiradas</dt><dd>{metrics.withdrawnFromAgenda}</dd></div>
        <div><dt>Incidencias</dt><dd>{metrics.incidents}</dd></div>
        <div><dt>Errores</dt><dd>{metrics.errors}</dd></div>
      </dl>
    </section>
  );
}
