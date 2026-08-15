import type { ExpedienteReadModel } from '../../types/expediente.types';
import { TabState } from './TabState';

export function PrestamosTab({ prestamo, loading = false, error = false }: {
  readonly prestamo: ExpedienteReadModel['prestamoActivo'];
  readonly loading?: boolean;
  readonly error?: boolean;
}) {
  return <TabState loading={loading} error={error} empty={!prestamo} emptyMessage="No hay préstamo activo.">
    {prestamo ? <p>{prestamo.finalidad} — {prestamo.estado} — {prestamo.fuenteHabilitanteSalida}</p> : null}
  </TabState>;
}
