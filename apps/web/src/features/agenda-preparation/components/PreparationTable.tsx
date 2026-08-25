/**
 * PreparationTable — T-24 preparation-reports REQ-PR-001
 *
 * Replaces the accordion-based PreparationList with a flat, paginable table
 * oriented for quick lookup. Filters operate on the already-loaded page of
 * items from the backend; no additional API calls are made for filtering.
 *
 * Design decisions:
 * - Pagination is offset-based in the client (50 rows/page) over whatever
 *   the backend cursor-page returned.
 * - No turno column (ADR-0031: turno is a PDF-only concern).
 * - No window.print() (replaced by ReportWizard in the Paquetes tab).
 */

import { useMemo, useState } from 'react';
import type { PreparationItem, PreparationOrder } from '../types/agenda.types';

const PAGE_SIZE = 50;

function consultaLabel(kind: PreparationItem['tipoConsulta']): string {
  return kind === 'FIRST_TIME' ? '1ª vez' : 'Subsecuente';
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
}

export function PreparationTable({
  loading,
  error,
  items,
  order,
  onOrderChange,
  nextCursor,
  loadingMore,
  onLoadMore,
}: Props) {
  const [filterServicio, setFilterServicio] = useState('');
  const [filterMedico, setFilterMedico]    = useState('');
  const [searchText, setSearchText]        = useState('');
  const [page, setPage]                    = useState(0);

  // Derive available service / physician options from loaded items
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
      if (q && !i.folio.toLowerCase().includes(q) && !i.expediente.original.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filterServicio, filterMedico, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageItems  = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function handleFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setter(e.target.value);
      setPage(0);
    };
  }

  return (
    <section className="preparation-table-section" aria-label="Lista de preparación">
      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="preparation-table-controls" role="group" aria-label="Filtros de lista de preparación">
        <label htmlFor="prep-order">Orden</label>
        <select
          id="prep-order"
          value={order}
          onChange={(e) => { onOrderChange(e.target.value as PreparationOrder); setPage(0); }}
        >
          <option value="APPOINTMENT_TIME_ASC">Hora de cita</option>
          <option value="PATIENT_NAME_ASC">Nombre del paciente</option>
        </select>

        <label htmlFor="prep-servicio">Servicio</label>
        <select id="prep-servicio" value={filterServicio} onChange={handleFilterChange(setFilterServicio)}>
          <option value="">Todos</option>
          {servicios.map((s) => (
            <option key={s.codigo} value={s.codigo}>
              {s.nombre} ({s.codigo})
            </option>
          ))}
        </select>

        <label htmlFor="prep-medico">Médico</label>
        <select id="prep-medico" value={filterMedico} onChange={handleFilterChange(setFilterMedico)}>
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
          onChange={handleFilterChange(setSearchText)}
        />
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
      {!loading && !error && filtered.length === 0 && (
        <p className="empty-state">
          {items.length === 0
            ? 'No hay citas activas para esta fecha.'
            : 'Sin resultados para los filtros seleccionados.'}
        </p>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {pageItems.length > 0 && (
        <>
          <p className="preparation-count" aria-live="polite">
            Mostrando {safePage * PAGE_SIZE + 1}–{safePage * PAGE_SIZE + pageItems.length} de{' '}
            {filtered.length} registros
          </p>
          <div className="table-responsive">
            <table
              className="preparation-table"
              aria-label="Lista de preparación"
              aria-rowcount={filtered.length}
            >
              <thead>
                <tr>
                  <th scope="col">Hora</th>
                  <th scope="col">Expediente</th>
                  <th scope="col">Folio</th>
                  <th scope="col">Derechohabiente</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Médico</th>
                  <th scope="col">Servicio</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <tr key={`${item.folio}-${item.appointmentTime}`}>
                    <td>{item.appointmentTime}</td>
                    <td>{item.expediente.original}</td>
                    <td>{item.folio}</td>
                    <td>{item.nombrePaciente}</td>
                    <td>{consultaLabel(item.tipoConsulta)}</td>
                    <td>{item.medico.nombre}</td>
                    <td>{item.servicioEspecialidad.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ──────────────────────────────────────────────── */}
          <nav aria-label="Paginación de lista de preparación" className="preparation-pagination">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Página anterior"
            >
              ← Anterior
            </button>
            <span aria-current="page">
              Página {safePage + 1} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              aria-label="Página siguiente"
            >
              Siguiente →
            </button>
          </nav>
        </>
      )}

      {/* ── Load more from backend ────────────────────────────────────────── */}
      {nextCursor && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          aria-label="Cargar más registros del servidor"
          className="load-more-button"
        >
          {loadingMore ? 'Cargando…' : 'Cargar más del servidor'}
        </button>
      )}
    </section>
  );
}
