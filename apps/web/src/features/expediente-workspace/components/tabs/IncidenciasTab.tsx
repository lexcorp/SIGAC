import type { ExpedienteReadModel } from '../../types/expediente.types';
import { TabState } from './TabState';

export function IncidenciasTab({ incidencias, loading = false, error = false }: {
  readonly incidencias: ExpedienteReadModel['incidenciasAbiertas'];
  readonly loading?: boolean;
  readonly error?: boolean;
}) {
  return <TabState loading={loading} error={error} empty={incidencias.length === 0} emptyMessage="No hay incidencias abiertas.">
    <ul>{incidencias.map((item) => <li key={item.incidenciaId}>{item.tipo} — {item.estado}</li>)}</ul>
  </TabState>;
}
