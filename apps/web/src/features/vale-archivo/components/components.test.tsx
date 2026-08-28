/**
 * T-38 — Tests de componentes, hooks y workspace de Vale Archivo.
 *
 * Patrón idéntico a agenda-preparation/components/components.test.tsx.
 * Sin lógica de negocio en los tests — solo comportamiento de la UI.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ValeArchivoSummary, ValeArchivoDetail, ValeArchivoProblem } from '../types/vale-archivo.types';
import { ValeArchivoList }   from './ValeArchivoList';
import { ValeArchivoForm }   from './ValeArchivoForm';
import { ValeArchivoDetail as ValeArchivoDetailComp } from './ValeArchivoDetail';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ITEM_ID = 'item-1111-2222-3333-4444-555555555555';

const sampleSummary: ValeArchivoSummary = {
  id: VALE_ID, numeroVale: 'VA-T38-001',
  fechaSolicitud: '2026-08-26', unidadSolicitante: 'DIRECCIÓN MÉDICA',
  solicitanteNombre: 'Dr. Sintético', estado: 'RECIBIDA', itemCount: 2,
};

const sampleDetail: ValeArchivoDetail = {
  id: VALE_ID, numeroVale: 'VA-T38-001',
  fechaSolicitud: '2026-08-26', fechaRecepcion: '2026-08-26',
  unidadSolicitante: 'DIRECCIÓN MÉDICA',
  solicitante: { nombre: 'Dr. Sintético', cargo: 'Director' },
  autorizador: { nombre: 'Dra. Sintética', cargo: 'Subdirectora' },
  estado: 'RECIBIDA', creadoPor: 'actor-t38',
  busquedaIniciadaPor: null, busquedaIniciadaAt: null,
  entregadoPor: null, entregadoAt: null, receptorEntrega: null,
  createdAt: '2026-08-26T10:00:00Z', actualizadoEn: '2026-08-26T10:00:00Z',
  items: [{
    id: ITEM_ID, expedienteNumero: 'EXP-T38-001',
    pacienteNombre: 'PACIENTE SINT T38', especialidad: 'MEDICINA INTERNA',
    estadoBusqueda: 'PENDIENTE', ubicacionEncontrada: null, observaciones: null,
  }],
};

// ── ValeArchivoList ───────────────────────────────────────────────────────────

describe('ValeArchivoList', () => {
  function renderList(items = [sampleSummary], extras = {}) {
    const onSelect = vi.fn();
    render(
      <ValeArchivoList
        items={items}
        loading={false}
        error={null}
        nextCursor={null}
        loadingMore={false}
        onLoadMore={vi.fn()}
        onSelect={onSelect}
        filterEstado=""
        filterFecha=""
        filterUnidad=""
        onFilterEstado={vi.fn()}
        onFilterFecha={vi.fn()}
        onFilterUnidad={vi.fn()}
        canCreate={true}
        onCreateNew={vi.fn()}
        {...extras}
      />,
    );
    return { onSelect };
  }

  it('muestra el número de vale en la tabla', () => {
    renderList();
    expect(screen.getByText('VA-T38-001')).toBeDefined();
  });

  it('muestra el estado del vale como badge', () => {
    renderList();
    expect(screen.getAllByText('Recibida').length).toBeGreaterThan(0);
  });

  it('muestra el nombre del solicitante', () => {
    renderList();
    expect(screen.getByText('Dr. Sintético')).toBeDefined();
  });

  it('muestra el botón "+ Nuevo Vale" cuando canCreate=true', () => {
    renderList();
    expect(screen.getByLabelText('Nuevo Vale SM 1-14')).toBeDefined();
  });

  it('oculta el botón "+ Nuevo Vale" cuando canCreate=false', () => {
    renderList([sampleSummary], { canCreate: false });
    expect(screen.queryByLabelText('Nuevo Vale SM 1-14')).toBeNull();
  });

  it('llama onSelect al hacer clic en el número de vale', async () => {
    const { onSelect } = renderList();
    const btn = screen.getByLabelText(`Ver detalle del vale ${sampleSummary.numeroVale}`);
    await userEvent.click(btn);
    expect(onSelect).toHaveBeenCalledWith(VALE_ID);
  });

  it('muestra el botón "Cargar más" cuando hay nextCursor', () => {
    renderList([sampleSummary], { nextCursor: 'cursor-opaque' });
    expect(screen.getByLabelText('Cargar más solicitudes')).toBeDefined();
  });

  it('no muestra "Cargar más" cuando nextCursor es null', () => {
    renderList();
    expect(screen.queryByLabelText('Cargar más solicitudes')).toBeNull();
  });

  it('muestra mensaje vacío cuando no hay items', () => {
    renderList([]);
    expect(screen.getByText(/no hay solicitudes/i)).toBeDefined();
  });

  it('muestra estado de carga cuando loading=true', () => {
    renderList([], { loading: true });
    expect(screen.getByLabelText('Cargando solicitudes')).toBeDefined();
  });

  it('muestra error cuando error no es null', () => {
    renderList([], { error: new Error('fail') });
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('múltiples estados se muestran correctamente', () => {
    const vales: ValeArchivoSummary[] = [
      { ...sampleSummary, id: '1', estado: 'EN_BUSQUEDA' },
      { ...sampleSummary, id: '2', estado: 'COMPLETA' },
      { ...sampleSummary, id: '3', estado: 'ENTREGADA' },
    ];
    renderList(vales);
    expect(screen.getAllByText('En búsqueda').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Completa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Entregada').length).toBeGreaterThan(0);
  });
});

// ── ValeArchivoForm ───────────────────────────────────────────────────────────

describe('ValeArchivoForm', () => {
  function renderForm(extras = {}) {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    render(
      <ValeArchivoForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        submitting={false}
        error={null}
        {...extras}
      />,
    );
    return { onSubmit, onCancel };
  }

  it('renderiza los campos de identificación del vale', () => {
    renderForm();
    expect(screen.getByLabelText('Número de vale')).toBeDefined();
    expect(screen.getByLabelText('Fecha de solicitud')).toBeDefined();
    expect(screen.getByLabelText('Unidad solicitante')).toBeDefined();
  });

  it('renderiza los campos del solicitante y autorizador', () => {
    renderForm();
    expect(screen.getByLabelText('Nombre', { selector: '#solicitante-nombre' })).toBeDefined();
    expect(screen.getByLabelText('Nombre', { selector: '#autorizador-nombre' })).toBeDefined();
  });

  it('muestra al menos una fila de expediente al iniciar', () => {
    renderForm();
    expect(screen.getByLabelText('Expediente 1')).toBeDefined();
  });

  it('agrega fila de expediente al hacer clic en "+ Agregar expediente"', async () => {
    renderForm();
    const addBtn = screen.getByLabelText('Agregar expediente');
    await userEvent.click(addBtn);
    expect(screen.getByLabelText('Expediente 2')).toBeDefined();
  });

  it('muestra error RFC7807 VALE_REQUIERE_ITEMS', () => {
    const error: ValeArchivoProblem = {
      type: 'https://sigac/errors/vale-requiere-items',
      title: 'Unprocessable', status: 422, code: 'VALE_REQUIERE_ITEMS',
    };
    renderForm({ error });
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/al menos un expediente/i)).toBeDefined();
  });

  it('muestra error HTTP_VALIDATION_ERROR con campo', () => {
    const error: ValeArchivoProblem = {
      type: 'https://sigac/errors/http-validation', title: 'Invalid', status: 400,
      code: 'HTTP_VALIDATION_ERROR', errors: [{ field: 'numeroVale', code: 'REQUIRED' }],
    };
    renderForm({ error });
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('muestra error PERMISSION_DENIED', () => {
    const error: ValeArchivoProblem = {
      type: 'https://sigac/errors/permission-denied', title: 'Forbidden',
      status: 403, code: 'PERMISSION_DENIED',
    };
    renderForm({ error });
    expect(screen.getByText(/no tienes permiso/i)).toBeDefined();
  });

  it('deshabilita el botón de guardar mientras submitting=true', () => {
    renderForm({ submitting: true });
    const btn = screen.getByLabelText('Guardar vale');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('llama onCancel al hacer clic en Cancelar', async () => {
    const { onCancel } = renderForm();
    await userEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ── ValeArchivoDetail — permisos y estado ─────────────────────────────────────

describe('ValeArchivoDetail', () => {
  function renderDetail(
    estado: ValeArchivoDetail['estado'] = 'RECIBIDA',
    permissions: string[] = ['REQUEST_CREATE', 'ARCHIVE_REQUEST_VIEW',
      'ARCHIVE_REQUEST_PROCESS', 'ARCHIVE_REQUEST_DELIVER'],
    extras = {},
  ) {
    const vale: ValeArchivoDetail = { ...sampleDetail, estado };
    const onAction = vi.fn();
    const onLocalizarItem = vi.fn();
    render(
      <ValeArchivoDetailComp
        vale={vale}
        loading={false}
        permissions={new Set(permissions)}
        onBack={vi.fn()}
        onAction={onAction}
        onLocalizarItem={onLocalizarItem}
        localizandoId={null}
        itemError={null}
        actioning={null}
        actionError={null}
        {...extras}
      />,
    );
    return { onAction, onLocalizarItem };
  }

  it('muestra el número de vale en el encabezado', () => {
    renderDetail();
    expect(screen.getByText(/VA-T38-001/)).toBeDefined();
  });

  it('muestra la timeline del ciclo de vida', () => {
    renderDetail();
    expect(screen.getByLabelText('Ciclo de vida del vale')).toBeDefined();
    expect(screen.getByText('Recibida')).toBeDefined();
  });

  it('paso activo en la timeline usa aria-current="step"', () => {
    renderDetail('EN_BUSQUEDA');
    const activeStep = document.querySelector('[aria-current="step"]');
    expect(activeStep).not.toBeNull();
  });

  // ── Visibilidad de acciones según permiso Y estado ──

  it('RECIBIDA + ARCHIVE_REQUEST_PROCESS → muestra "Iniciar búsqueda"', () => {
    renderDetail('RECIBIDA', ['ARCHIVE_REQUEST_PROCESS', 'ARCHIVE_REQUEST_VIEW']);
    expect(screen.getByLabelText('Iniciar búsqueda de expedientes')).toBeDefined();
  });

  it('EN_BUSQUEDA + ARCHIVE_REQUEST_PROCESS → NO muestra "Iniciar búsqueda"', () => {
    renderDetail('EN_BUSQUEDA', ['ARCHIVE_REQUEST_PROCESS', 'ARCHIVE_REQUEST_VIEW']);
    expect(screen.queryByLabelText('Iniciar búsqueda de expedientes')).toBeNull();
  });

  it('COMPLETA + ARCHIVE_REQUEST_DELIVER → muestra "Registrar entrega"', () => {
    renderDetail('COMPLETA', ['ARCHIVE_REQUEST_DELIVER', 'ARCHIVE_REQUEST_VIEW']);
    expect(screen.getByLabelText('Registrar entrega de expedientes')).toBeDefined();
  });

  it('RECIBIDA + ARCHIVE_REQUEST_DELIVER → NO muestra "Registrar entrega"', () => {
    renderDetail('RECIBIDA', ['ARCHIVE_REQUEST_DELIVER', 'ARCHIVE_REQUEST_VIEW']);
    expect(screen.queryByLabelText('Registrar entrega de expedientes')).toBeNull();
  });

  it('NO_LOCALIZADA + REQUEST_CREATE → muestra "Cerrar administrativamente"', () => {
    renderDetail('NO_LOCALIZADA', ['REQUEST_CREATE', 'ARCHIVE_REQUEST_VIEW']);
    expect(screen.getByLabelText('Cerrar vale administrativamente')).toBeDefined();
  });

  it('ENTREGADA + REQUEST_CREATE → NO muestra "Cerrar administrativamente"', () => {
    renderDetail('ENTREGADA', ['REQUEST_CREATE', 'ARCHIVE_REQUEST_VIEW']);
    expect(screen.queryByLabelText('Cerrar vale administrativamente')).toBeNull();
  });

  it('EN_BUSQUEDA + ARCHIVE_REQUEST_VIEW → muestra botón PDF', () => {
    renderDetail('EN_BUSQUEDA', ['ARCHIVE_REQUEST_VIEW']);
    expect(screen.getByLabelText('Descargar formato SM 1-14 en PDF')).toBeDefined();
  });

  it('RECIBIDA + ARCHIVE_REQUEST_VIEW → NO muestra botón PDF (vale no procesado)', () => {
    renderDetail('RECIBIDA', ['ARCHIVE_REQUEST_VIEW']);
    expect(screen.queryByLabelText('Descargar formato SM 1-14 en PDF')).toBeNull();
  });

  it('sin ningún permiso relevante → no muestra botones de acción', () => {
    renderDetail('RECIBIDA', []);
    expect(screen.queryByLabelText('Iniciar búsqueda de expedientes')).toBeNull();
    expect(screen.queryByLabelText('Registrar entrega de expedientes')).toBeNull();
    expect(screen.queryByLabelText('Descargar formato SM 1-14 en PDF')).toBeNull();
  });

  it('llama onAction("iniciarBusqueda") al hacer clic', async () => {
    const { onAction } = renderDetail('RECIBIDA', ['ARCHIVE_REQUEST_PROCESS']);
    await userEvent.click(screen.getByLabelText('Iniciar búsqueda de expedientes'));
    expect(onAction).toHaveBeenCalledWith('iniciarBusqueda');
  });

  it('llama onAction("pdf") al hacer clic en PDF', async () => {
    const { onAction } = renderDetail('EN_BUSQUEDA', ['ARCHIVE_REQUEST_VIEW']);
    await userEvent.click(screen.getByLabelText('Descargar formato SM 1-14 en PDF'));
    expect(onAction).toHaveBeenCalledWith('pdf');
  });

  it('muestra error de acción RFC7807 INVALID_STATE_TRANSITION', () => {
    const actionError: ValeArchivoProblem = {
      type: 'https://sigac/errors/invalid-state-transition',
      title: 'Unprocessable', status: 422, code: 'INVALID_STATE_TRANSITION',
    };
    renderDetail('RECIBIDA', ['ARCHIVE_REQUEST_PROCESS'], { actionError });
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/no es válida para el estado actual/i)).toBeDefined();
  });

  it('EN_BUSQUEDA + ARCHIVE_REQUEST_PROCESS → muestra botones de localización en tabla', () => {
    const vale: ValeArchivoDetail = {
      ...sampleDetail,
      estado: 'EN_BUSQUEDA',
      busquedaIniciadaPor: 'actor-t38',
      busquedaIniciadaAt: '2026-08-26T11:00:00Z',
    };
    render(
      <ValeArchivoDetailComp
        vale={vale}
        loading={false}
        permissions={new Set(['ARCHIVE_REQUEST_PROCESS', 'ARCHIVE_REQUEST_VIEW'])}
        onBack={vi.fn()}
        onAction={vi.fn()}
        onLocalizarItem={vi.fn()}
        localizandoId={null}
        itemError={null}
        actioning={null}
        actionError={null}
      />,
    );
    expect(screen.getByLabelText(`Marcar expediente EXP-T38-001 como localizado`)).toBeDefined();
    expect(screen.getByLabelText(`Marcar expediente EXP-T38-001 como no localizado`)).toBeDefined();
  });

  it('no muestra la tabla de acciones de localización cuando estado no es EN_BUSQUEDA', () => {
    renderDetail('COMPLETA', ['ARCHIVE_REQUEST_PROCESS']);
    expect(screen.queryByLabelText('Marcar expediente EXP-T38-001 como localizado')).toBeNull();
  });

  it('el detalle muestra información de la sección de entrega si receptorEntrega existe', () => {
    const vale: ValeArchivoDetail = {
      ...sampleDetail, estado: 'ENTREGADA',
      receptorEntrega: 'Lic. Receptor T38',
      entregadoPor: 'actor-t38',
      entregadoAt: '2026-08-26T15:00:00Z',
    };
    render(
      <ValeArchivoDetailComp
        vale={vale} loading={false}
        permissions={new Set(['ARCHIVE_REQUEST_VIEW'])}
        onBack={vi.fn()} onAction={vi.fn()} onLocalizarItem={vi.fn()}
        localizandoId={null} itemError={null} actioning={null} actionError={null}
      />,
    );
    expect(screen.getByText('Lic. Receptor T38')).toBeDefined();
  });
});
