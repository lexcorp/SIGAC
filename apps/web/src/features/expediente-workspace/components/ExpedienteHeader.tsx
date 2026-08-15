import type { ExpedienteReadModel } from '../types/expediente.types';
import { ESTADOS_OPERATIVOS } from '../types/expediente.types';

export interface ExpedienteHeaderProps {
  readonly expediente?: ExpedienteReadModel | null;
  readonly loading?: boolean;
}

export function ExpedienteHeader({ expediente, loading = false }: ExpedienteHeaderProps) {
  if (loading) {
    return <section className="expediente-header skeleton" aria-label="Cargando expediente" aria-busy="true" />;
  }
  if (!expediente) {
    return <section className="empty-state">Selecciona un expediente para consultar su situación.</section>;
  }
  if (!ESTADOS_OPERATIVOS.includes(expediente.estadoOperativo)) return null;

  return (
    <header className="expediente-header">
      <div>
        <p className="eyebrow">Expediente</p>
        <h1>{expediente.expedienteNumero}</h1>
        <p>{expediente.pacienteRef.displayLabel}</p>
      </div>
      <dl className="expediente-facts">
        <div>
          <dt>Estado operativo</dt>
          <dd><span className={`status-badge status-${expediente.estadoOperativo.toLowerCase()}`}>{expediente.estadoOperativo}</span></dd>
        </div>
        <div>
          <dt>Ubicación actual</dt>
          <dd>{expediente.ubicacionActual?.descripcion ?? 'Sin ubicación registrada'}</dd>
        </div>
        <div>
          <dt>Custodio actual</dt>
          <dd>{expediente.custodiaActual?.custodioRef ?? 'Sin custodia registrada'}</dd>
          {expediente.estadoOperativo === 'EN_CONSULTA' && expediente.custodiaActual?.aceptadaEn
            ? <dd>Aceptada: <time dateTime={expediente.custodiaActual.aceptadaEn}>{formatDate(expediente.custodiaActual.aceptadaEn)}</time></dd>
            : null}
        </div>
        <div>
          <dt>Préstamo activo</dt>
          <dd>{expediente.prestamoActivo ? expediente.prestamoActivo.estado : 'No'}</dd>
        </div>
        <div>
          <dt>Incidencias abiertas</dt>
          <dd>{expediente.incidenciasAbiertas.length}</dd>
        </div>
      </dl>
    </header>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
