import { useState } from 'react';
import type { PreparationItem, PreparationOrder } from '../types/agenda.types';

interface GroupKey {
  servicioCodigo: string;
  servicioNombre: string;
  medicoNumeroEmpleado: string;
  medicoNombre: string;
}

function groupItems(
  items: readonly PreparationItem[],
): Map<string, { key: GroupKey; items: PreparationItem[] }> {
  const groups = new Map<string, { key: GroupKey; items: PreparationItem[] }>();
  for (const item of items) {
    const groupId = `${item.servicioEspecialidad.codigo}||${item.servicioEspecialidad.nombre}||${item.medico.numeroEmpleado}||${item.medico.nombre}`;
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        key: {
          servicioCodigo: item.servicioEspecialidad.codigo,
          servicioNombre: item.servicioEspecialidad.nombre,
          medicoNumeroEmpleado: item.medico.numeroEmpleado,
          medicoNombre: item.medico.nombre,
        },
        items: [],
      });
    }
    groups.get(groupId)!.items.push(item);
  }
  return groups;
}

interface Props {
  readonly loading?: boolean;
  readonly error?: Error | null;
  readonly items: readonly PreparationItem[];
  readonly order: PreparationOrder;
  readonly onOrderChange: (order: PreparationOrder) => void;
  readonly nextCursor: string | null;
  readonly loadingMore?: boolean;
  readonly onLoadMore: () => void;
  readonly onPrint: () => void;
}

export function PreparationList({
  loading,
  error,
  items,
  order,
  onOrderChange,
  nextCursor,
  loadingMore,
  onLoadMore,
  onPrint,
}: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groups = groupItems(items);

  return (
    <section className="preparation-list" aria-label="Lista de preparación">
      <div className="preparation-list-controls">
        <label htmlFor="preparation-order">Orden</label>
        <select
          id="preparation-order"
          value={order}
          onChange={(e) => onOrderChange(e.target.value as PreparationOrder)}
        >
          <option value="APPOINTMENT_TIME_ASC">Hora de cita</option>
          <option value="PATIENT_NAME_ASC">Nombre del paciente</option>
        </select>
        <button
          type="button"
          onClick={onPrint}
          aria-label="Imprimir lista de preparación completa"
        >
          Imprimir lista
        </button>
      </div>

      {loading && (
        <div className="skeleton" aria-busy="true">
          Cargando lista…
        </div>
      )}
      {error && (
        <p role="alert" className="problem-banner">
          No fue posible cargar la lista de preparación.
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="empty-state">No hay citas activas para esta fecha.</div>
      )}

      {[...groups.entries()].map(([groupId, { key, items: groupItems }]) => (
        <div key={groupId} className="preparation-group">
          <button
            type="button"
            className="preparation-group-header"
            aria-expanded={expandedGroups.has(groupId)}
            aria-label={`${key.servicioNombre} (${key.servicioCodigo}) — ${key.medicoNombre}`}
            onClick={() => toggleGroup(groupId)}
          >
            <span className="servicio-label">
              {key.servicioNombre} ({key.servicioCodigo})
            </span>
            <span className="medico-label">
              {key.medicoNombre} · Empleado {key.medicoNumeroEmpleado}
            </span>
          </button>
          {expandedGroups.has(groupId) && (
            <table
              className="preparation-table"
              aria-label={`Citas de ${key.medicoNombre}`}
            >
              <thead>
                <tr>
                  <th scope="col">Hora</th>
                  <th scope="col">Expediente</th>
                  <th scope="col">Derechohabiente</th>
                  <th scope="col">Tipo DH</th>
                  <th scope="col">Cita</th>
                  <th scope="col">FOLIO</th>
                </tr>
              </thead>
              <tbody>
                {groupItems.map((item) => (
                  <tr key={item.folio}>
                    <td>{item.appointmentTime}</td>
                    <td>{item.expediente.original}</td>
                    <td>{item.nombrePaciente}</td>
                    <td>{item.tipoDerechohabiente}</td>
                    <td>{item.tipoConsulta === 'FIRST_TIME' ? 'Primera' : 'Subsecuente'}</td>
                    <td>{item.folio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {nextCursor && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          aria-label="Cargar más elementos de la lista de preparación"
        >
          {loadingMore ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
    </section>
  );
}
