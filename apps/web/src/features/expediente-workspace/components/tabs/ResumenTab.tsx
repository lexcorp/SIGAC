import type { ExpedienteReadModel } from '../../types/expediente.types';
import { TabState } from './TabState';

export function ResumenTab({ expediente, loading = false, error = false }: {
  readonly expediente: ExpedienteReadModel | null;
  readonly loading?: boolean;
  readonly error?: boolean;
}) {
  return (
    <TabState loading={loading} error={error} empty={!expediente} emptyMessage="No hay resumen disponible.">
      {expediente ? (
        <dl className="summary-grid">
          <div><dt>Estado</dt><dd>{expediente.estadoOperativo}</dd></div>
          <div><dt>Custodia</dt><dd>{expediente.custodiaActual?.custodioRef ?? 'Sin custodia'}</dd></div>
          {expediente.estadoOperativo === 'EN_CONSULTA' && expediente.custodiaActual?.aceptadaEn
            ? <div><dt>Aceptada</dt><dd>{expediente.custodiaActual.aceptadaEn}</dd></div>
            : null}
          <div><dt>Solicitud activa</dt><dd>{expediente.solicitudActiva?.estado ?? 'Sin solicitud activa'}</dd></div>
          <div><dt>Préstamo activo</dt><dd>{expediente.prestamoActivo?.estado ?? 'Sin préstamo activo'}</dd></div>
          {expediente.prestamoActivo
            ? <div><dt>Fuente habilitante</dt><dd>{expediente.prestamoActivo.fuenteHabilitanteSalida}</dd></div>
            : null}
        </dl>
      ) : null}
    </TabState>
  );
}
