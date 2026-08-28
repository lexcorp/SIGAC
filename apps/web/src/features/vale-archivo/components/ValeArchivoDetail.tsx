/**
 * ValeArchivoDetail — vista de detalle del vale SM 1-14.
 *
 * Incluye:
 *   - StatusTimeline: representación visual del ciclo de vida
 *   - ItemsTable: expedientes con acciones de localización inline
 *   - ActionButtons: acciones filtradas por permiso Y estado (no solo permiso)
 *   - PDF como acción primaria
 *
 * Regla: el frontend oculta botones inaccesibles, pero el backend es la autoridad.
 * Los errores de transición (422 INVALID_STATE_TRANSITION) se muestran como mensaje.
 */
import { useState } from 'react';
import type {
  EstadoVale,
  ValeArchivoDetail as ValeArchivoDetailType,
  ValeArchivoItemDetail,
  ValeArchivoProblem,
} from '../types/vale-archivo.types';

// ── StatusTimeline ────────────────────────────────────────────────────────────

const CICLO: Array<{ estado: EstadoVale | EstadoVale[]; label: string }> = [
  { estado: 'RECIBIDA',    label: 'Recibida' },
  { estado: 'EN_BUSQUEDA', label: 'En búsqueda' },
  { estado: ['COMPLETA', 'PARCIAL', 'NO_LOCALIZADA'], label: 'Resultado búsqueda' },
  { estado: 'ENTREGADA',   label: 'Entregada' },
  { estado: 'CERRADA',     label: 'Cerrada' },
];

function stepIsActive(step: EstadoVale | EstadoVale[], current: EstadoVale): boolean {
  return Array.isArray(step) ? step.includes(current) : step === current;
}

function stepIsPast(stepIdx: number, currentIdx: number): boolean {
  return stepIdx < currentIdx;
}

function currentStepIdx(estado: EstadoVale): number {
  return CICLO.findIndex((s) => stepIsActive(s.estado, estado));
}

function StatusTimeline({ estado }: { readonly estado: EstadoVale }) {
  const activeIdx = currentStepIdx(estado);
  return (
    <nav aria-label="Ciclo de vida del vale" className="vale-status-timeline">
      <ol className="timeline-steps">
        {CICLO.map((step, idx) => {
          const active = stepIsActive(step.estado, estado);
          const past   = stepIsPast(idx, activeIdx);
          return (
            <li
              key={idx}
              className={`timeline-step ${active ? 'active' : ''} ${past ? 'past' : ''}`}
              aria-current={active ? 'step' : undefined}
            >
              <span className="step-dot" />
              <span className="step-label">
                {/* Para COMPLETA/PARCIAL/NO_LOCALIZADA mostrar el estado real */}
                {active && Array.isArray(step.estado)
                  ? estado.charAt(0) + estado.slice(1).toLowerCase().replace(/_/g, ' ')
                  : step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── ItemsTable ────────────────────────────────────────────────────────────────

function estadoBusquedaLabel(e: string): string {
  const m: Record<string, string> = {
    PENDIENTE:     'Pendiente',
    LOCALIZADO:    'Localizado',
    NO_LOCALIZADO: 'No localizado',
  };
  return m[e] ?? e;
}

interface ItemsTableProps {
  readonly items: readonly ValeArchivoItemDetail[];
  readonly canProcess: boolean;
  readonly estadoVale: EstadoVale;
  readonly onLocalizarItem: (itemId: string, estado: 'LOCALIZADO' | 'NO_LOCALIZADO', ubicacion: string) => void;
  readonly localizandoId: string | null;
  readonly error: ValeArchivoProblem | null;
}

function ItemsTable({ items, canProcess, estadoVale, onLocalizarItem, localizandoId, error }: ItemsTableProps) {
  const [ubicaciones, setUbicaciones] = useState<Record<string, string>>({});
  const canLocalize = canProcess && estadoVale === 'EN_BUSQUEDA';

  return (
    <section aria-label="Expedientes del vale">
      <h3>Expedientes solicitados</h3>
      {error && (
        <p role="alert" className="problem-banner" aria-live="assertive">
          {error.detail ?? 'Error al registrar localización.'}
        </p>
      )}
      <div className="table-responsive">
        <table aria-label="Lista de expedientes del vale">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Expediente</th>
              <th scope="col">Derechohabiente</th>
              <th scope="col">Especialidad</th>
              <th scope="col">Estado búsqueda</th>
              <th scope="col">Ubicación</th>
              {canLocalize && <th scope="col">Acción</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id}>
                <td>{idx + 1}</td>
                <td>{item.expedienteNumero}</td>
                <td>{item.pacienteNombre}</td>
                <td>{item.especialidad}</td>
                <td>
                  <span className={`estado-busqueda-badge estado-${item.estadoBusqueda.toLowerCase()}`}>
                    {estadoBusquedaLabel(item.estadoBusqueda)}
                  </span>
                </td>
                <td>{item.ubicacionEncontrada ?? '—'}</td>
                {canLocalize && item.estadoBusqueda === 'PENDIENTE' && (
                  <td>
                    <input
                      type="text"
                      placeholder="Ubicación física"
                      value={ubicaciones[item.id] ?? ''}
                      onChange={(e) =>
                        setUbicaciones((u) => ({ ...u, [item.id]: e.target.value }))
                      }
                      aria-label={`Ubicación del expediente ${item.expedienteNumero}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onLocalizarItem(item.id, 'LOCALIZADO', ubicaciones[item.id] ?? '')
                      }
                      disabled={localizandoId === item.id}
                      aria-label={`Marcar expediente ${item.expedienteNumero} como localizado`}
                    >
                      Localizado
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onLocalizarItem(item.id, 'NO_LOCALIZADO', '')
                      }
                      disabled={localizandoId === item.id}
                      aria-label={`Marcar expediente ${item.expedienteNumero} como no localizado`}
                    >
                      No localizado
                    </button>
                  </td>
                )}
                {canLocalize && item.estadoBusqueda !== 'PENDIENTE' && <td>—</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── ActionButtons ─────────────────────────────────────────────────────────────

interface ActionButtonsProps {
  readonly vale: ValeArchivoDetailType;
  readonly canCreate: boolean;
  readonly canProcess: boolean;
  readonly canDeliver: boolean;
  readonly canView: boolean;
  readonly onIniciarBusqueda: () => void;
  readonly onRegistrarEntrega: () => void;
  readonly onCerrar: () => void;
  readonly onDescargarPdf: () => void;
  readonly actioning: string | null;
  readonly actionError: ValeArchivoProblem | null;
}

function ActionButtons({
  vale, canCreate, canProcess, canDeliver, canView,
  onIniciarBusqueda, onRegistrarEntrega, onCerrar, onDescargarPdf,
  actioning, actionError,
}: ActionButtonsProps) {
  const { estado } = vale;

  // Lógica de visibilidad: permiso AND estado actual.
  // El backend es la autoridad — el frontend solo oculta para UX limpia.
  const showIniciarBusqueda  = canProcess && estado === 'RECIBIDA';
  const showRegistrarEntrega = canDeliver && (estado === 'COMPLETA' || estado === 'PARCIAL');
  const showCerrar           = canCreate  && estado === 'NO_LOCALIZADA';
  const showPdf              = canView    && estado !== 'RECIBIDA';

  return (
    <div className="vale-action-buttons" role="group" aria-label="Acciones del vale">
      {/* PDF — acción primaria si disponible */}
      {showPdf && (
        <button
          type="button"
          onClick={onDescargarPdf}
          disabled={actioning === 'pdf'}
          aria-label="Descargar formato SM 1-14 en PDF"
          className="action-primary"
        >
          {actioning === 'pdf' ? 'Descargando…' : '📄 Descargar SM 1-14'}
        </button>
      )}

      {showIniciarBusqueda && (
        <button
          type="button"
          onClick={onIniciarBusqueda}
          disabled={actioning === 'busqueda'}
          aria-label="Iniciar búsqueda de expedientes"
        >
          {actioning === 'busqueda' ? 'Iniciando…' : 'Iniciar búsqueda'}
        </button>
      )}

      {showRegistrarEntrega && (
        <button
          type="button"
          onClick={onRegistrarEntrega}
          disabled={actioning === 'entrega'}
          aria-label="Registrar entrega de expedientes"
        >
          {actioning === 'entrega' ? 'Registrando…' : 'Registrar entrega'}
        </button>
      )}

      {showCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          disabled={actioning === 'cerrar'}
          aria-label="Cerrar vale administrativamente"
          className="action-secondary"
        >
          {actioning === 'cerrar' ? 'Cerrando…' : 'Cerrar administrativamente'}
        </button>
      )}

      {actionError && (
        <p role="alert" className="problem-banner" aria-live="assertive">
          {actionError.code === 'INVALID_STATE_TRANSITION'
            ? 'La acción no es válida para el estado actual del vale.'
            : actionError.detail ?? 'Error al ejecutar la acción.'}
        </p>
      )}
    </div>
  );
}

// ── ValeArchivoDetail (root) ──────────────────────────────────────────────────

interface Props {
  readonly vale: ValeArchivoDetailType;
  readonly loading: boolean;
  readonly permissions: ReadonlySet<string>;
  readonly onBack: () => void;
  readonly onAction: (
    action: 'iniciarBusqueda' | 'entrega' | 'cerrar' | 'pdf',
  ) => void;
  readonly onLocalizarItem: (
    itemId: string,
    estado: 'LOCALIZADO' | 'NO_LOCALIZADO',
    ubicacion: string,
  ) => void;
  readonly localizandoId: string | null;
  readonly itemError: ValeArchivoProblem | null;
  readonly actioning: string | null;
  readonly actionError: ValeArchivoProblem | null;
}

export function ValeArchivoDetail({
  vale, loading, permissions, onBack, onAction,
  onLocalizarItem, localizandoId, itemError, actioning, actionError,
}: Props) {
  const canView    = permissions.has('ARCHIVE_REQUEST_VIEW') || permissions.has('REQUEST_CREATE');
  const canCreate  = permissions.has('REQUEST_CREATE');
  const canProcess = permissions.has('ARCHIVE_REQUEST_PROCESS');
  const canDeliver = permissions.has('ARCHIVE_REQUEST_DELIVER');

  if (loading) {
    return (
      <section aria-busy="true" aria-label="Cargando detalle del vale">
        <div className="skeleton">Cargando detalle…</div>
      </section>
    );
  }

  return (
    <section className="vale-archivo-detail" aria-label={`Detalle del vale ${vale.numeroVale}`}>
      <div className="detail-header">
        <button type="button" onClick={onBack} aria-label="Volver a la lista de vales">
          ← Volver
        </button>
        <h2>Vale {vale.numeroVale}</h2>
      </div>

      {/* Ciclo de vida */}
      <StatusTimeline estado={vale.estado} />

      {/* Acciones primarias */}
      <ActionButtons
        vale={vale}
        canCreate={canCreate} canProcess={canProcess}
        canDeliver={canDeliver} canView={canView}
        onIniciarBusqueda={() => onAction('iniciarBusqueda')}
        onRegistrarEntrega={() => onAction('entrega')}
        onCerrar={() => onAction('cerrar')}
        onDescargarPdf={() => onAction('pdf')}
        actioning={actioning}
        actionError={actionError}
      />

      {/* Datos del vale */}
      <section aria-label="Información del vale" className="vale-info-grid">
        <dl>
          <dt>Fecha de solicitud</dt>
          <dd>{new Date(vale.fechaSolicitud).toLocaleDateString('es-MX')}</dd>
          <dt>Fecha de recepción</dt>
          <dd>{new Date(vale.fechaRecepcion).toLocaleDateString('es-MX')}</dd>
          <dt>Unidad solicitante</dt>
          <dd>{vale.unidadSolicitante}</dd>
          <dt>Solicitante</dt>
          <dd>{vale.solicitante.nombre} — {vale.solicitante.cargo}</dd>
          <dt>Autoriza</dt>
          <dd>{vale.autorizador.nombre} — {vale.autorizador.cargo}</dd>
          {vale.receptorEntrega && (
            <>
              <dt>Entregado a</dt>
              <dd>{vale.receptorEntrega}</dd>
              <dt>Fecha de entrega</dt>
              <dd>{vale.entregadoAt ? new Date(vale.entregadoAt).toLocaleDateString('es-MX') : '—'}</dd>
            </>
          )}
        </dl>
      </section>

      {/* Tabla de expedientes */}
      <ItemsTable
        items={vale.items}
        canProcess={canProcess}
        estadoVale={vale.estado}
        onLocalizarItem={onLocalizarItem}
        localizandoId={localizandoId}
        error={itemError}
      />
    </section>
  );
}
