/**
 * ValeArchivoList — tabla paginada de solicitudes con filtros.
 * Fuente de datos: useValeArchivoList (cursor-based, GET /vale-archivo).
 */
import type { ValeArchivoSummary, EstadoVale } from '../types/vale-archivo.types';

const ESTADOS: EstadoVale[] = [
  'RECIBIDA', 'EN_BUSQUEDA', 'COMPLETA', 'PARCIAL',
  'NO_LOCALIZADA', 'ENTREGADA', 'CERRADA',
];

function estadoLabel(e: EstadoVale): string {
  const map: Record<EstadoVale, string> = {
    RECIBIDA:      'Recibida',
    EN_BUSQUEDA:   'En búsqueda',
    COMPLETA:      'Completa',
    PARCIAL:       'Parcial',
    NO_LOCALIZADA: 'No localizada',
    ENTREGADA:     'Entregada',
    CERRADA:       'Cerrada',
  };
  return map[e];
}

interface Props {
  readonly items: readonly ValeArchivoSummary[];
  readonly loading: boolean;
  readonly error: Error | null;
  readonly nextCursor: string | null;
  readonly loadingMore: boolean;
  readonly onLoadMore: () => void;
  readonly onSelect: (id: string) => void;
  readonly filterEstado: EstadoVale | '';
  readonly filterFecha: string;
  readonly filterUnidad: string;
  readonly onFilterEstado: (v: EstadoVale | '') => void;
  readonly onFilterFecha: (v: string) => void;
  readonly onFilterUnidad: (v: string) => void;
  readonly canCreate: boolean;
  readonly onCreateNew: () => void;
}

export function ValeArchivoList({
  items, loading, error, nextCursor, loadingMore,
  onLoadMore, onSelect,
  filterEstado, filterFecha, filterUnidad,
  onFilterEstado, onFilterFecha, onFilterUnidad,
  canCreate, onCreateNew,
}: Props) {
  return (
    <section className="vale-archivo-list" aria-label="Solicitudes de expedientes">
      <div className="vale-archivo-toolbar">
        <h2>Solicitudes de expedientes</h2>
        {canCreate && (
          <button type="button" onClick={onCreateNew} aria-label="Nuevo Vale SM 1-14">
            + Nuevo Vale
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="vale-archivo-filters" role="group" aria-label="Filtros de solicitudes">
        <label htmlFor="filtro-estado">Estado</label>
        <select
          id="filtro-estado"
          value={filterEstado}
          onChange={(e) => onFilterEstado(e.target.value as EstadoVale | '')}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{estadoLabel(e)}</option>
          ))}
        </select>

        <label htmlFor="filtro-fecha">Fecha</label>
        <input
          id="filtro-fecha"
          type="date"
          value={filterFecha}
          onChange={(e) => onFilterFecha(e.target.value)}
          aria-label="Filtrar por fecha de solicitud"
        />

        <label htmlFor="filtro-unidad">Unidad solicitante</label>
        <input
          id="filtro-unidad"
          type="text"
          value={filterUnidad}
          placeholder="Buscar unidad…"
          onChange={(e) => onFilterUnidad(e.target.value)}
          aria-label="Filtrar por unidad solicitante"
        />
      </div>

      {loading && (
        <div className="skeleton" aria-busy="true" aria-label="Cargando solicitudes">
          Cargando…
        </div>
      )}

      {!loading && error && (
        <p role="alert" className="problem-banner">
          No fue posible cargar las solicitudes. Intenta de nuevo.
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="empty-state">No hay solicitudes que coincidan con los filtros.</p>
      )}

      {items.length > 0 && (
        <div className="table-responsive">
          <table aria-label="Lista de vales SM 1-14">
            <thead>
              <tr>
                <th scope="col">Vale</th>
                <th scope="col">Fecha solicitud</th>
                <th scope="col">Solicitante</th>
                <th scope="col">Unidad</th>
                <th scope="col">Expedientes</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr
                  key={v.id}
                  className="vale-row"
                  onClick={() => onSelect(v.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={(e) => { e.stopPropagation(); onSelect(v.id); }}
                      aria-label={`Ver detalle del vale ${v.numeroVale}`}
                    >
                      {v.numeroVale}
                    </button>
                  </td>
                  <td>{new Date(v.fechaSolicitud).toLocaleDateString('es-MX')}</td>
                  <td>{v.solicitanteNombre}</td>
                  <td>{v.unidadSolicitante}</td>
                  <td>{v.itemCount}</td>
                  <td>
                    <span className={`estado-badge estado-${v.estado.toLowerCase()}`}>
                      {estadoLabel(v.estado)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          aria-label="Cargar más solicitudes"
          className="load-more"
        >
          {loadingMore ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
    </section>
  );
}
