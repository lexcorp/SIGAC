/**
 * PreparationTable — T-24 / T-P1
 *
 * Paginación server-side con selector de tamaño (50/100/200).
 * Cada página hace un request independiente al backend — sin acumulación.
 * No existe botón "Cargar más del servidor".
 *
 * Filtros (servicio, médico, búsqueda texto) operan sobre los ítems de la
 * página actual. Cualquier cambio de filtro, orden, tamaño o fecha reinicia
 * al cursor undefined (primera página).
 *
 * El turno NO aparece en la tabla (ADR-0031: es un concern del PDF).
 */
import { useMemo, useState, useEffect } from 'react';
import type { PreparationItem, PreparationOrder } from '../types/agenda.types';
import type { PageSize } from '../hooks/useAgendaPreparationList';

// Defined locally so this component has no runtime dependency on the hook module
const PAGE_SIZE_OPTIONS: readonly PageSize[] = [50, 100, 200] as const;

function consultaLabel(kind: PreparationItem['tipoConsulta']): string {
  return kind === 'FIRST_TIME' ? '1ª vez' : 'Subsecuente';
}

interface Props {
  readonly loading?: boolean;
  readonly error?: Error | null;
  readonly items: readonly PreparationItem[];
  readonly order: PreparationOrder;
  readonly onOrderChange: (order: PreparationOrder) => void;
  // Server-side pagination
  readonly pageSize: PageSize;
  readonly onPageSizeChange: (size: PageSize) => void;
  readonly currentPage: number;           // 1-based display page
  readonly hasPrevPage: boolean;
  readonly hasNextPage: boolean;
  readonly onPrevPage: () => void;
  readonly onNextPage: () => void;
  readonly totalLoaded: number;           // items on this page (for "Mostrando X–Y")
}

export function PreparationTable({
  loading,
  error,
  items,
  order,
  onOrderChange,
  pageSize,
  onPageSizeChange,
  currentPage,
  hasPrevPage,
  hasNextPage,
  onPrevPage,
  onNextPage,
  totalLoaded,
}: Props) {
  const [filterServicio, setFilterServicio] = useState('');
  const [filterMedico,   setFilterMedico]   = useState('');
  const [searchText,     setSearchText]     = useState('');

  // Reset client-side filters when items change (new page or date)
  useEffect(() => {
    setFilterServicio('');
    setFilterMedico('');
    setSearchText('');
  }, [items]);

  const servicios = useMemo(
    () =>
      [...new Map(
        items.map((i) => [i.servicioEspecialidad.codigo, i.servicioEspecialidad]),
      ).values()].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [items],
  );

  const medicos = useMemo(
    () =>
      [...new Map(
        items
          .filter((i) => !filterServicio || i.servicioEspecialidad.codigo === filterServicio)
          .map((i) => [i.medico.numeroEmpleado, i.medico]),
      ).values()].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [items, filterServicio],
  );

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return items.filter((i) => {
      if (filterServicio && i.servicioEspecialidad.codigo !== filterServicio) return false;
      if (filterMedico   && i.medico.numeroEmpleado          !== filterMedico)   return false;
      if (q && !i.folio.toLowerCase().includes(q) &&
          !i.expediente.original.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filterServicio, filterMedico, searchText]);

  // First item on this server page (1-based)
  const firstItem = (currentPage - 1) * pageSize + 1;
  // Last item shown depends on client-side filter
  const lastItem  = firstItem + filtered.length - 1;

  return (
    <section className="preparation-table-section" aria-label="Lista de preparación">

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="preparation-table-controls" role="group" aria-label="Filtros de lista de preparación">
        <label htmlFor="prep-order">Orden</label>
        <select
          id="prep-order"
          value={order}
          onChange={(e) => onOrderChange(e.target.value as PreparationOrder)}
        >
          <option value="SERVICE_MEDICO_HORA_ASC">Servicio → Médico → Hora (operativo)</option>
          <option value="APPOINTMENT_TIME_ASC">Hora de cita</option>
          <option value="PATIENT_NAME_ASC">Nombre del paciente</option>
        </select>

        <label htmlFor="prep-servicio">Servicio</label>
        <select
          id="prep-servicio"
          value={filterServicio}
          onChange={(e) => setFilterServicio(e.target.value)}
        >
          <option value="">Todos</option>
          {servicios.map((s) => (
            <option key={s.codigo} value={s.codigo}>
              {s.nombre} ({s.codigo})
            </option>
          ))}
        </select>

        <label htmlFor="prep-medico">Médico</label>
        <select
          id="prep-medico"
          value={filterMedico}
          onChange={(e) => setFilterMedico(e.target.value)}
        >
          <option value="">Todos</option>
          {medicos.map((m) => (
            <option key={m.numeroEmpleado} value={m.numeroEmpleado}>
              {m.nombre}
            </option>
          ))}
        </select>

        <label htmlFor="prep-search">Buscar</label>
        <input
          id="prep-search"
          type="search"
          placeholder="Folio o expediente…"
          value={searchText}
          aria-label="Buscar por folio o expediente"
          onChange={(e) => setSearchText(e.target.value)}
        />

        {/* Selector de tamaño de página */}
        <label htmlFor="prep-page-size">Mostrar</label>
        <select
          id="prep-page-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          aria-label="Registros por página"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* ── States ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="skeleton" aria-busy="true" aria-label="Cargando lista de preparación">
          Cargando lista…
        </div>
      )}
      {error && (
        <p role="alert" className="problem-banner">
          No fue posible cargar la lista de preparación.
        </p>
      )}
      {!loading && !error && filtered.length === 0 && items.length === 0 && (
        <p className="empty-state">No hay citas activas para esta fecha.</p>
      )}
      {!loading && !error && filtered.length === 0 && items.length > 0 && (
        <p className="empty-state">Sin resultados para los filtros seleccionados.</p>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <>
          <p className="preparation-count" aria-live="polite">
            {filtered.length < items.length
              ? `${filtered.length} registros filtrados de ${totalLoaded} en esta página`
              : `Mostrando ${firstItem}–${lastItem} de al menos ${lastItem} registros`}
          </p>
          <div className="table-responsive">
            <table
              className="preparation-table"
              aria-label="Lista de preparación"
            >
              <thead>
                <tr>
                  <th scope="col">Hora</th>
                  <th scope="col">Expediente</th>
                  <th scope="col">Folio</th>
                  <th scope="col">Derechohabiente</th>
                  <th scope="col">Tipo DH</th>
                  <th scope="col">Cita</th>
                  <th scope="col">Médico</th>
                  <th scope="col">Servicio</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={`${item.folio}-${item.appointmentTime}`}>
                    <td>{item.appointmentTime}</td>
                    <td>{item.expediente.original}</td>
                    <td>{item.folio}</td>
                    <td>{item.nombrePaciente}</td>
                    <td>{item.tipoDerechohabiente}</td>
                    <td>{consultaLabel(item.tipoConsulta)}</td>
                    <td>{item.medico.nombre}</td>
                    <td>{item.servicioEspecialidad.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Server-side pagination (NO "Cargar más") ──────────────────── */}
          <nav aria-label="Paginación de lista de preparación" className="preparation-pagination">
            <button
              type="button"
              onClick={onPrevPage}
              disabled={!hasPrevPage || loading}
              aria-label="Página anterior"
            >
              ← Anterior
            </button>
            <span aria-live="polite">
              Página {currentPage}
            </span>
            <button
              type="button"
              onClick={onNextPage}
              disabled={!hasNextPage || loading}
              aria-label="Página siguiente"
            >
              Siguiente →
            </button>
          </nav>
        </>
      )}
      {/* No "Cargar más del servidor" button — paginación server-side real */}
    </section>
  );
}
