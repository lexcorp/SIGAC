/**
 * ValeArchivoWorkspace — root del bounded context Vale Archivo.
 *
 * Tres vistas: lista ↔ detalle ↔ formulario-crear.
 * Patrón idéntico a AgendaPreparationWorkspace.
 *
 * Permisos mínimos para acceder:
 *   ARCHIVE_REQUEST_VIEW  → lista + detalle + PDF
 *   REQUEST_CREATE        → crear + detalle + PDF
 * Sin ninguno: mensaje de acceso denegado.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { valeArchivoApi, ValeArchivoApiError } from './api/valeArchivoApi';
import { useValeArchivoList }   from './hooks/useValeArchivoList';
import { useValeArchivoDetail } from './hooks/useValeArchivoDetail';
import { ValeArchivoList }   from './components/ValeArchivoList';
import { ValeArchivoForm }   from './components/ValeArchivoForm';
import { ValeArchivoDetail } from './components/ValeArchivoDetail';
import type {
  EstadoVale,
  ValeArchivoProblem,
  CreateValeInput,
} from './types/vale-archivo.types';

type View = 'lista' | 'detalle' | 'crear';

interface Props {
  readonly permissions: ReadonlySet<string>;
}

export function ValeArchivoWorkspace({ permissions }: Props) {
  const canView    = permissions.has('ARCHIVE_REQUEST_VIEW') || permissions.has('REQUEST_CREATE');
  const canCreate  = permissions.has('REQUEST_CREATE');

  // ── Router state ─────────────────────────────────────────────────────────
  const [view, setView]           = useState<View>('lista');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── List filters ──────────────────────────────────────────────────────────
  const [filterEstado, setFilterEstado] = useState<EstadoVale | ''>('');
  const [filterFecha,  setFilterFecha]  = useState('');
  const [filterUnidad, setFilterUnidad] = useState('');

  // ── Data ──────────────────────────────────────────────────────────────────
  const listQuery = useValeArchivoList(
    {
      estado:  filterEstado || undefined,
      fecha:   filterFecha  || undefined,
      unidad:  filterUnidad || undefined,
    },
    canView && view === 'lista',
  );

  const listItems = listQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const nextCursor = listQuery.data?.pages.at(-1)?.nextCursor ?? null;

  const detailQuery = useValeArchivoDetail(
    view === 'detalle' ? selectedId : null,
  );

  const qc = useQueryClient();

  // ── Form state ────────────────────────────────────────────────────────────
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState<ValeArchivoProblem | null>(null);

  // ── Action state ──────────────────────────────────────────────────────────
  const [actioning,   setActioning]   = useState<string | null>(null);
  const [actionError, setActionError] = useState<ValeArchivoProblem | null>(null);
  const [localizandoId, setLocalizandoId] = useState<string | null>(null);
  const [itemError,   setItemError]   = useState<ValeArchivoProblem | null>(null);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!canView && !canCreate) {
    return (
      <main className="vale-archivo-workspace">
        <p role="alert" className="problem-banner">
          No tienes permiso para consultar Solicitudes de expedientes.
        </p>
      </main>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function selectVale(id: string) {
    setSelectedId(id);
    setActionError(null);
    setItemError(null);
    setView('detalle');
  }

  async function handleCreateVale(input: CreateValeInput) {
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await valeArchivoApi.createVale(input);
      // Invalidar lista e ir al detalle del nuevo vale
      void qc.invalidateQueries({ queryKey: ['vale-archivo-list'] });
      selectVale(result.id);
    } catch (err) {
      if (err instanceof ValeArchivoApiError && err.problem) {
        setFormError(err.problem);
      } else {
        setFormError({ type: '', title: '', status: 500, code: 'INTERNAL_ERROR',
          detail: 'No fue posible crear el vale.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(action: 'iniciarBusqueda' | 'entrega' | 'cerrar' | 'pdf') {
    if (!selectedId || !detailQuery.data) return;
    setActioning(action);
    setActionError(null);
    try {
      if (action === 'pdf') {
        const v = detailQuery.data;
        const date = v.fechaSolicitud.slice(0, 10);
        const safe = v.numeroVale.replace(/[/\\\s]+/g, '-').replace(/[^\w.-]/g, '');
        await valeArchivoApi.descargarPdf(selectedId, `sm1-14-${safe}-${date}.pdf`);
      } else if (action === 'iniciarBusqueda') {
        await valeArchivoApi.iniciarBusqueda(selectedId);
        void qc.invalidateQueries({ queryKey: ['vale-archivo-detail', selectedId] });
      } else if (action === 'entrega') {
        // Entrega todos los ítems localizados
        const items = detailQuery.data.items
          .filter((i) => i.estadoBusqueda === 'LOCALIZADO')
          .map((i) => i.id);
        await valeArchivoApi.registrarEntrega(selectedId, {
          receptorEntrega: prompt('Nombre del receptor de entrega:') ?? '',
          entregadoAt: new Date().toISOString(),
          itemsEntregados: items,
        });
        void qc.invalidateQueries({ queryKey: ['vale-archivo-detail', selectedId] });
      } else if (action === 'cerrar') {
        await valeArchivoApi.cerrarVale(selectedId);
        void qc.invalidateQueries({ queryKey: ['vale-archivo-detail', selectedId] });
      }
    } catch (err) {
      if (err instanceof ValeArchivoApiError && err.problem) {
        setActionError(err.problem);
      } else {
        setActionError({ type: '', title: '', status: 500, code: 'INTERNAL_ERROR',
          detail: 'Error al ejecutar la acción.' });
      }
    } finally {
      setActioning(null);
    }
  }

  async function handleLocalizarItem(
    itemId: string,
    estado: 'LOCALIZADO' | 'NO_LOCALIZADO',
    ubicacion: string,
  ) {
    if (!selectedId) return;
    setLocalizandoId(itemId);
    setItemError(null);
    try {
      await valeArchivoApi.registrarLocalizacion(selectedId, itemId, {
        estadoBusqueda: estado,
        ubicacionEncontrada: ubicacion || undefined,
      });
      void qc.invalidateQueries({ queryKey: ['vale-archivo-detail', selectedId] });
    } catch (err) {
      if (err instanceof ValeArchivoApiError && err.problem) {
        setItemError(err.problem);
      }
    } finally {
      setLocalizandoId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="vale-archivo-workspace">
      <h1>Solicitudes de expedientes</h1>

      {view === 'lista' && (
        <ValeArchivoList
          items={listItems}
          loading={listQuery.isLoading}
          error={listQuery.isError ? listQuery.error : null}
          nextCursor={nextCursor}
          loadingMore={listQuery.isFetchingNextPage}
          onLoadMore={() => { void listQuery.fetchNextPage(); }}
          onSelect={selectVale}
          filterEstado={filterEstado}
          filterFecha={filterFecha}
          filterUnidad={filterUnidad}
          onFilterEstado={setFilterEstado}
          onFilterFecha={setFilterFecha}
          onFilterUnidad={setFilterUnidad}
          canCreate={canCreate}
          onCreateNew={() => { setFormError(null); setView('crear'); }}
        />
      )}

      {view === 'crear' && (
        <ValeArchivoForm
          onSubmit={handleCreateVale}
          onCancel={() => setView('lista')}
          submitting={submitting}
          error={formError}
        />
      )}

      {view === 'detalle' && detailQuery.data && (
        <ValeArchivoDetail
          vale={detailQuery.data}
          loading={detailQuery.isLoading}
          permissions={permissions}
          onBack={() => {
            setView('lista');
            void qc.invalidateQueries({ queryKey: ['vale-archivo-list'] });
          }}
          onAction={(a) => { void handleAction(a); }}
          onLocalizarItem={(id, estado, ub) => { void handleLocalizarItem(id, estado, ub); }}
          localizandoId={localizandoId}
          itemError={itemError}
          actioning={actioning}
          actionError={actionError}
        />
      )}

      {view === 'detalle' && detailQuery.isLoading && (
        <div className="skeleton" aria-busy="true">Cargando vale…</div>
      )}

      {view === 'detalle' && detailQuery.isError && (
        <div>
          <button type="button" onClick={() => setView('lista')}>← Volver</button>
          <p role="alert" className="problem-banner">No fue posible cargar el vale.</p>
        </div>
      )}
    </main>
  );
}
