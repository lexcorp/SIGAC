import type { ExpedienteReadModel } from '../../types/expediente.types';
import { TabState } from './TabState';

export function SolicitudesTab({ solicitud, loading = false, error = false }: {
  readonly solicitud: ExpedienteReadModel['solicitudActiva'];
  readonly loading?: boolean;
  readonly error?: boolean;
}) {
  return <TabState loading={loading} error={error} empty={!solicitud} emptyMessage="No hay solicitud activa.">
    {solicitud ? <p>{solicitud.tipo} — {solicitud.estado}</p> : null}
  </TabState>;
}
