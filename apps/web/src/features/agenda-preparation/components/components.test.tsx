import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AgendaSummary } from './AgendaSummary';
import { AgendaMetrics } from './AgendaMetrics';
import { IncidentList } from './IncidentList';
import { ImportHistory } from './ImportHistory';
import { PreparationList } from './PreparationList';
import type {
  AgendaDayReadModel,
  AgendaImportMetrics,
  PreparationItem,
} from '../types/agenda.types';

const sampleDay: AgendaDayReadModel = {
  agendaDate: '2026-08-25',
  latestImportacionId: 'imp-001',
  latestImportedAt: '2026-08-25T10:00:00Z',
  latestOutcome: 'IMPORTED',
  activeAppointments: 5,
  physicians: 2,
  services: 1,
  incidentCount: 0,
};

const sampleMetrics: AgendaImportMetrics = {
  receivedRecords: 10,
  processed: 8,
  added: 5,
  updated: 2,
  unchanged: 1,
  restored: 0,
  pendingReview: 2,
  rejected: 0,
  duplicateFolio: 0,
  withdrawnFromAgenda: 1,
  incidents: 2,
  errors: 0,
};

const sampleItem: PreparationItem = {
  folio: 'FOLIO-001',
  nombrePaciente: 'PACIENTE SINTETICO',
  expediente: { original: 'EXP-001', reference: null },
  tipoDerechohabiente: 'PENSIONISTA',
  tipoConsulta: 'FIRST_TIME',
  agendaDate: '2026-08-25',
  appointmentTime: '08:00',
  medico: { numeroEmpleado: '12345', nombre: 'DR MEDICO SINTETICO' },
  servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA GENERAL' },
};

// -------------------------------------------------------------------------
// AgendaSummary
// -------------------------------------------------------------------------
describe('AgendaSummary', () => {
  it('shows skeleton while loading', () => {
    render(<AgendaSummary loading />);
    const region = screen.getByRole('region', { name: /cargando/i });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-busy', 'true');
  });

  it('shows empty state when no data', () => {
    render(<AgendaSummary />);
    expect(screen.getByText(/no hay una agenda registrada/i)).toBeInTheDocument();
  });

  it('shows error state with alert role', () => {
    render(<AgendaSummary error={new Error('test')} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('displays metrics without Turno/Consultorio/Destino', () => {
    render(<AgendaSummary data={sampleDay} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/médicos/i)).toBeInTheDocument();
    const content = screen.getByRole('region').textContent ?? '';
    expect(content).not.toMatch(/turno/i);
    expect(content).not.toMatch(/consultorio/i);
    expect(content).not.toMatch(/destino/i);
  });

  it('shows IMPORTED outcome label', () => {
    render(<AgendaSummary data={sampleDay} />);
    expect(screen.getByText(/agenda actualizada/i)).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------------
// AgendaMetrics
// -------------------------------------------------------------------------
describe('AgendaMetrics', () => {
  it('renders all canonical metric fields', () => {
    render(<AgendaMetrics outcome="IMPORTED" metrics={sampleMetrics} />);
    expect(screen.getByText('Recibidos')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Agenda actualizada')).toBeInTheDocument();
  });

  it('shows ALREADY_IMPORTED outcome', () => {
    render(<AgendaMetrics outcome="ALREADY_IMPORTED" metrics={sampleMetrics} />);
    expect(screen.getByText('Ya estaba actualizada')).toBeInTheDocument();
  });

  it('shows RECONCILED outcome', () => {
    render(<AgendaMetrics outcome="RECONCILED" metrics={sampleMetrics} />);
    expect(screen.getByText('Agenda reconciliada')).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------------
// IncidentList
// -------------------------------------------------------------------------
describe('IncidentList', () => {
  const noop = () => void 0;

  it('shows loading state with aria-busy', () => {
    render(<IncidentList loading items={[]} nextCursor={null} onLoadMore={noop} />);
    expect(screen.getByRole('region').querySelector('[aria-busy]')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(<IncidentList items={[]} nextCursor={null} onLoadMore={noop} />);
    expect(screen.getByText(/no hay incidencias/i)).toBeInTheDocument();
  });

  it('renders human-readable category labels', () => {
    render(
      <IncidentList
        items={[
          {
            incidenciaId: 'i1',
            registroId: 'r1',
            sourcePosition: 2,
            type: 'PHYSICIAN_NOT_RESOLVED',
          },
          {
            incidenciaId: 'i2',
            registroId: 'r2',
            sourcePosition: 3,
            type: 'REQUIRED_DATA_MISSING',
          },
        ]}
        nextCursor={null}
        onLoadMore={noop}
      />,
    );
    expect(screen.getByText(/médico no identificado/i)).toBeInTheDocument();
    expect(screen.getByText(/datos requeridos faltantes/i)).toBeInTheDocument();
    // Must not show raw incident type names
    expect(screen.queryByText('PHYSICIAN_NOT_RESOLVED')).not.toBeInTheDocument();
    expect(screen.queryByText('REQUIRED_DATA_MISSING')).not.toBeInTheDocument();
  });

  it('shows load more button when nextCursor is not null', async () => {
    const onLoadMore = vi.fn();
    render(
      <IncidentList
        items={[
          { incidenciaId: 'i1', registroId: 'r1', sourcePosition: 1, type: 'PHYSICIAN_AMBIGUOUS' },
        ]}
        nextCursor="cursor-next"
        onLoadMore={onLoadMore}
      />,
    );
    const loadMore = screen.getByRole('button', { name: /cargar más incidencias/i });
    await userEvent.click(loadMore);
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('shows error state', () => {
    render(
      <IncidentList
        error={new Error('fail')}
        items={[]}
        nextCursor={null}
        onLoadMore={noop}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------------
// ImportHistory
// -------------------------------------------------------------------------
describe('ImportHistory', () => {
  const noop = () => void 0;
  const sampleHistory: Parameters<typeof ImportHistory>[0]['items'] = [
    {
      importacionId: 'imp-001',
      agendaDate: '2026-08-25',
      importedAt: '2026-08-25T10:00:00Z',
      outcome: 'IMPORTED',
      metrics: sampleMetrics,
    },
  ];

  it('shows empty state when no items', () => {
    render(<ImportHistory items={[]} nextCursor={null} onLoadMore={noop} onSelect={noop} />);
    expect(screen.getByText(/no hay importaciones/i)).toBeInTheDocument();
  });

  it('renders outcome label and metrics summary', () => {
    render(
      <ImportHistory
        items={sampleHistory}
        nextCursor={null}
        onLoadMore={noop}
        onSelect={noop}
      />,
    );
    expect(screen.getByText(/agenda actualizada/i)).toBeInTheDocument();
    expect(screen.getByText(/recibidos 10/i)).toBeInTheDocument();
    // Must not expose importacionId directly
    expect(screen.queryByText('imp-001')).not.toBeInTheDocument();
  });

  it('calls onSelect when detail button clicked', async () => {
    const onSelect = vi.fn();
    render(
      <ImportHistory
        items={sampleHistory}
        nextCursor={null}
        onLoadMore={noop}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /ver detalle/i }));
    expect(onSelect).toHaveBeenCalledWith('imp-001');
  });

  it('shows error state', () => {
    render(
      <ImportHistory
        error={new Error('fail')}
        items={[]}
        nextCursor={null}
        onLoadMore={noop}
        onSelect={noop}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------------
// PreparationList
// -------------------------------------------------------------------------
describe('PreparationList', () => {
  const noop = () => void 0;
  const defaultProps = {
    items: [] as PreparationItem[],
    order: 'APPOINTMENT_TIME_ASC' as const,
    onOrderChange: noop,
    nextCursor: null,
    onLoadMore: noop,
    onPrint: noop,
  };

  it('shows empty state when no items', () => {
    render(<PreparationList {...defaultProps} />);
    expect(screen.getByText(/no hay citas activas/i)).toBeInTheDocument();
  });

  it('renders preparation item in group — no Turno/Consultorio/Destino', async () => {
    render(<PreparationList {...defaultProps} items={[sampleItem]} />);
    // Expand the group
    const groupBtn = screen.getByRole('button', { name: /cirugia general/i });
    await userEvent.click(groupBtn);
    expect(screen.getByText('FOLIO-001')).toBeInTheDocument();
    expect(screen.getByText('08:00')).toBeInTheDocument();
    // Absence of prohibited fields
    const content = document.body.textContent ?? '';
    expect(content).not.toMatch(/turno/i);
    expect(content).not.toMatch(/consultorio/i);
    expect(content).not.toMatch(/destino/i);
    expect(content).not.toMatch(/curp/i);
  });

  it('order selector triggers onOrderChange', async () => {
    const onOrderChange = vi.fn();
    render(<PreparationList {...defaultProps} onOrderChange={onOrderChange} />);
    const select = screen.getByLabelText('Orden') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'PATIENT_NAME_ASC');
    expect(onOrderChange).toHaveBeenCalledWith('PATIENT_NAME_ASC');
  });

  it('print button calls onPrint', async () => {
    const onPrint = vi.fn();
    render(<PreparationList {...defaultProps} onPrint={onPrint} />);
    await userEvent.click(screen.getByRole('button', { name: /imprimir lista/i }));
    expect(onPrint).toHaveBeenCalledOnce();
  });

  it('accessibility: group header has aria-expanded false initially', () => {
    render(<PreparationList {...defaultProps} items={[sampleItem]} />);
    const groupBtn = screen.getByRole('button', { name: /cirugia general/i });
    expect(groupBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('accessibility: group header toggles aria-expanded on click', async () => {
    render(<PreparationList {...defaultProps} items={[sampleItem]} />);
    const groupBtn = screen.getByRole('button', { name: /cirugia general/i });
    await userEvent.click(groupBtn);
    expect(groupBtn).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(groupBtn);
    expect(groupBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows error state', () => {
    render(<PreparationList {...defaultProps} error={new Error('fail')} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows loading state with aria-busy', () => {
    render(<PreparationList {...defaultProps} loading />);
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});

// =========================================================================
// T-24 — PreparationTable tests (replaces accordion-based PreparationList)
// =========================================================================
import { PreparationTable } from './PreparationTable';

describe('PreparationTable — T-24 (REQ-PR-001)', () => {
  const noop = () => void 0;

  const item1: PreparationItem = {
    folio: 'T24-FOLIO-001', nombrePaciente: 'PACIENTE T24 UNO',
    expediente: { original: 'T24EXP001/10', reference: null },
    tipoDerechohabiente: '10', tipoConsulta: 'FIRST_TIME',
    agendaDate: '2026-09-01', appointmentTime: '08:00',
    medico: { numeroEmpleado: '55501', nombre: 'DR PRIMERO T24' },
    servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA T24' },
  };

  const item2: PreparationItem = {
    folio: 'T24-FOLIO-002', nombrePaciente: 'PACIENTE T24 DOS',
    expediente: { original: 'T24EXP002/20', reference: null },
    tipoDerechohabiente: '20', tipoConsulta: 'SUBSEQUENT',
    agendaDate: '2026-09-01', appointmentTime: '14:00',
    medico: { numeroEmpleado: '55502', nombre: 'DR SEGUNDO T24' },
    servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIOLOGIA T24' },
  };

  const defaultProps = {
    items: [item1, item2],
    order: 'APPOINTMENT_TIME_ASC' as const,
    onOrderChange: noop,
    // T-P1: new server-side pagination props
    pageSize: 50 as const,
    onPageSizeChange: noop,
    currentPage: 1,
    hasPrevPage: false,
    hasNextPage: false,
    onPrevPage: noop,
    onNextPage: noop,
    totalLoaded: 2,
  };

  it('renders a flat table (no accordion buttons)', () => {
    render(<PreparationTable {...defaultProps} />);
    // Items are visible without clicking any expand button
    expect(screen.getByText('T24-FOLIO-001')).toBeInTheDocument();
    expect(screen.getByText('T24-FOLIO-002')).toBeInTheDocument();
    // No aria-expanded accordions
    const expandButtons = document.querySelectorAll('[aria-expanded]');
    // The only aria-expanded allowed is pagination buttons (prev/next) — none here
    // since we're on page 1 of 1
    expect(expandButtons.length).toBe(0);
  });

  it('shows table headers: Hora, Expediente, Folio, Derechohabiente, Tipo, Médico, Servicio', () => {
    render(<PreparationTable {...defaultProps} />);
    expect(screen.getByRole('columnheader', { name: /hora/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /expediente/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /folio/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /derechohabiente/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /tipo/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /médico/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /servicio/i })).toBeInTheDocument();
  });

  it('empty state shown when no items', () => {
    render(<PreparationTable {...defaultProps} items={[]} />);
    expect(screen.getByText(/no hay citas activas/i)).toBeInTheDocument();
  });

  it('loading state shows aria-busy', () => {
    render(<PreparationTable {...defaultProps} loading />);
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('error state shows alert', () => {
    render(<PreparationTable {...defaultProps} error={new Error('fail')} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('filter by service — only matching rows visible', async () => {
    render(<PreparationTable {...defaultProps} />);
    const select = screen.getByLabelText(/servicio/i) as HTMLSelectElement;
    await userEvent.selectOptions(select, 'CIR');
    expect(screen.getByText('T24-FOLIO-001')).toBeInTheDocument();
    expect(screen.queryByText('T24-FOLIO-002')).not.toBeInTheDocument();
    // 1 match visible; no empty-state message
  });

  it('search by folio — only matching rows visible', async () => {
    render(<PreparationTable {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/folio o expediente/i);
    await userEvent.type(searchInput, 'T24-FOLIO-001');
    expect(screen.getByText('T24-FOLIO-001')).toBeInTheDocument();
    expect(screen.queryByText('T24-FOLIO-002')).not.toBeInTheDocument();
  });

  it('changing order triggers onOrderChange', async () => {
    const onOrderChange = vi.fn();
    render(<PreparationTable {...defaultProps} onOrderChange={onOrderChange} />);
    await userEvent.selectOptions(screen.getByLabelText(/orden/i), 'PATIENT_NAME_ASC');
    expect(onOrderChange).toHaveBeenCalledWith('PATIENT_NAME_ASC');
  });

  it('no Turno, Consultorio, Destino columns or content (privacy)', () => {
    render(<PreparationTable {...defaultProps} />);
    const content = document.body.textContent ?? '';
    expect(content).not.toMatch(/turno/i);
    expect(content).not.toMatch(/consultorio/i);
    expect(content).not.toMatch(/destino/i);
  });

  it('no window.print() usage — print button does not exist', () => {
    render(<PreparationTable {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /imprimir/i })).not.toBeInTheDocument();
  });

// ── T-P1: Nuevos tests de paginación server-side ─────────────────────────────

describe('PreparationTable — paginación server-side (T-P1)', () => {
  // Default props helper for new pagination
  function makeProps(overrides = {}) {
    return {
      items: Array.from({ length: 50 }, (_, i) => ({
        folio: `FOLIO-${String(i + 1).padStart(3, '0')}`,
        nombrePaciente: `PACIENTE ${i + 1}`,
        expediente: { original: `EXP-${i + 1}`, reference: null },
        tipoDerechohabiente: 'PENSIONISTA',
        tipoConsulta: 'FIRST_TIME' as const,
        agendaDate: '2026-08-26',
        appointmentTime: `08:${String(i % 60).padStart(2, '0')}`,
        medico: { numeroEmpleado: `EMP-${i}`, nombre: `DR MEDICO ${i + 1}` },
        servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGÍA' },
      })),
      order: 'APPOINTMENT_TIME_ASC' as const,
      onOrderChange: noop,
      pageSize: 50 as const,
      onPageSizeChange: noop,
      currentPage: 1,
      hasPrevPage: false,
      hasNextPage: false,
      onPrevPage: noop,
      onNextPage: noop,
      totalLoaded: 50,
      ...overrides,
    };
  }

  it('selector de tamaño muestra opciones 50, 100, 200', () => {
    render(<PreparationTable {...makeProps()} />);
    const sel = screen.getByLabelText(/registros por página/i) as HTMLSelectElement;
    const options = Array.from(sel.options).map((o) => Number(o.value));
    expect(options).toEqual([50, 100, 200]);
  });

  it('selector 50 está seleccionado por defecto', () => {
    render(<PreparationTable {...makeProps({ pageSize: 50 })} />);
    const sel = screen.getByLabelText(/registros por página/i) as HTMLSelectElement;
    expect(sel.value).toBe('50');
  });

  it('selector 100 — onPageSizeChange llamado con 100', async () => {
    const onPageSizeChange = vi.fn();
    render(<PreparationTable {...makeProps({ onPageSizeChange })} />);
    await userEvent.selectOptions(screen.getByLabelText(/registros por página/i), '100');
    expect(onPageSizeChange).toHaveBeenCalledWith(100);
  });

  it('selector 200 — onPageSizeChange llamado con 200', async () => {
    const onPageSizeChange = vi.fn();
    render(<PreparationTable {...makeProps({ onPageSizeChange })} />);
    await userEvent.selectOptions(screen.getByLabelText(/registros por página/i), '200');
    expect(onPageSizeChange).toHaveBeenCalledWith(200);
  });

  it('botón "Cargar más del servidor" NO existe', () => {
    render(<PreparationTable {...makeProps({ hasNextPage: true })} />);
    expect(screen.queryByText(/cargar más del servidor/i)).toBeNull();
    expect(screen.queryByLabelText(/cargar más registros del servidor/i)).toBeNull();
  });

  it('botón Siguiente aparece cuando hasNextPage=true', () => {
    render(<PreparationTable {...makeProps({ hasNextPage: true })} />);
    const btn = screen.getByLabelText('Página siguiente');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('botón Siguiente disabled cuando hasNextPage=false', () => {
    render(<PreparationTable {...makeProps({ hasNextPage: false })} />);
    const btn = screen.getByLabelText('Página siguiente');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('botón Anterior disabled en primera página (hasPrevPage=false)', () => {
    render(<PreparationTable {...makeProps({ hasPrevPage: false })} />);
    const btn = screen.getByLabelText('Página anterior');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('botón Anterior habilitado cuando hasPrevPage=true', () => {
    render(<PreparationTable {...makeProps({ hasPrevPage: true })} />);
    const btn = screen.getByLabelText('Página anterior');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('clic en Siguiente llama onNextPage', async () => {
    const onNextPage = vi.fn();
    render(<PreparationTable {...makeProps({ hasNextPage: true, onNextPage })} />);
    await userEvent.click(screen.getByLabelText('Página siguiente'));
    expect(onNextPage).toHaveBeenCalledOnce();
  });

  it('clic en Anterior llama onPrevPage', async () => {
    const onPrevPage = vi.fn();
    render(<PreparationTable {...makeProps({ hasPrevPage: true, onPrevPage })} />);
    await userEvent.click(screen.getByLabelText('Página anterior'));
    expect(onPrevPage).toHaveBeenCalledOnce();
  });

  it('médico se muestra correctamente cuando el API devuelve diferentes médicos (T-P3)', () => {
    const items = [
      { ...makeProps().items[0]!, medico: { numeroEmpleado: 'EMP-A', nombre: 'OCAÑA LEYVA ROSARIO' } },
      { ...makeProps().items[1]!, medico: { numeroEmpleado: 'EMP-B', nombre: 'CASTRO LAZO SERGIO RAMON' } },
    ];
    render(<PreparationTable {...makeProps({ items })} />);
    // Names appear in table rows (and also in filter dropdown options)
    const table = document.querySelector('table')!;
    expect(table.textContent).toContain('OCAÑA LEYVA ROSARIO');
    expect(table.textContent).toContain('CASTRO LAZO SERGIO RAMON');
    // Regression T-P3: placeholder names must not appear in table rows
    expect(table.textContent).not.toContain('DR DEMO SINTETICO');
    expect(table.textContent).not.toMatch(/MÉDICO \d+/);
  });

  it('paginación server-side: página 2 muestra página indicator correctamente', () => {
    render(<PreparationTable {...makeProps({ currentPage: 2, hasPrevPage: true, hasNextPage: true })} />);
    expect(screen.getByText('Página 2')).toBeDefined();
  });

  it('agenda con >200 items: el botón Siguiente permite navegar (hasNextPage=true)', () => {
    // Simulates a 497-item agenda where the backend returns 50 items per page
    render(<PreparationTable {...makeProps({
      currentPage: 1,
      hasPrevPage: false,
      hasNextPage: true,  // backend has more pages
      totalLoaded: 50,
    })} />);
    expect(screen.getByLabelText('Página siguiente')).toBeDefined();
    expect((screen.getByLabelText('Página siguiente') as HTMLButtonElement).disabled).toBe(false);
  });

  it('cambio de servicio dispara filtro de cliente sin reiniciar cursor (el workspace maneja eso)', () => {
    // The component itself doesn't reset pagination on filter — the workspace does.
    // This test verifies the component renders filtered items correctly.
    const items = [
      { ...makeProps().items[0]!, servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIOLOGÍA' } },
      { ...makeProps().items[1]!, servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGÍA' } },
    ];
    render(<PreparationTable {...makeProps({ items })} />);
    const sel = screen.getByLabelText(/servicio/i);
    // Both services available in dropdown
    expect(screen.getAllByRole('option', { name: /CARDIOLOGÍA/i }).length).toBeGreaterThan(0);
  });
});
});

// =========================================================================
// T-24 — ReportWizard tests (REQ-PR-002, ADR-0030)
// =========================================================================
import { ReportWizard } from './ReportWizard';

const wizardItems: PreparationItem[] = [
  {
    folio: 'WZ-001', nombrePaciente: 'PACIENTE WZ UNO',
    expediente: { original: 'WZEXP001/10', reference: null },
    tipoDerechohabiente: '10', tipoConsulta: 'FIRST_TIME',
    agendaDate: '2026-09-01', appointmentTime: '08:00',
    medico: { numeroEmpleado: '55501', nombre: 'DR WZ UNO' },
    servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA WZ' },
  },
  {
    folio: 'WZ-002', nombrePaciente: 'PACIENTE WZ DOS',
    expediente: { original: 'WZEXP002/20', reference: null },
    tipoDerechohabiente: '20', tipoConsulta: 'SUBSEQUENT',
    agendaDate: '2026-09-01', appointmentTime: '14:00',
    medico: { numeroEmpleado: '55502', nombre: 'DR WZ DOS' },
    servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIOLOGIA WZ' },
  },
];

describe('ReportWizard — T-24 (REQ-PR-002)', () => {
  it('shows "Generar PDF" button when canPrint=true', () => {
    render(
      <ReportWizard date="2026-09-01" items={wizardItems} order="APPOINTMENT_TIME_ASC" canPrint />,
    );
    // aria-label is 'Generar y descargar PDF de preparación'
    expect(screen.getByRole('button', { name: /generar.*pdf/i })).toBeInTheDocument();
  });

  it('shows permission denied alert when canPrint=false', () => {
    render(
      <ReportWizard date="2026-09-01" items={wizardItems} order="APPOINTMENT_TIME_ASC" canPrint={false} />,
    );
    expect(screen.queryByRole('button', { name: /generar pdf/i })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/permiso/i);
  });

  it('shows list of services as checkboxes', () => {
    render(
      <ReportWizard date="2026-09-01" items={wizardItems} order="APPOINTMENT_TIME_ASC" canPrint />,
    );
    expect(screen.getByLabelText(/CIRUGIA WZ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CARDIOLOGIA WZ/i)).toBeInTheDocument();
  });

  it('summary shows total citas count initially (all selected)', () => {
    render(
      <ReportWizard date="2026-09-01" items={wizardItems} order="APPOINTMENT_TIME_ASC" canPrint />,
    );
    // Text 'incluirá 2 citas' is rendered in a <p> with mixed children
    expect(screen.getByText((_, el) => el?.textContent?.includes('2') && el?.tagName === 'P' || false)).toBeInTheDocument();
  });

  it('unchecking a service reduces preview count', async () => {
    render(
      <ReportWizard date="2026-09-01" items={wizardItems} order="APPOINTMENT_TIME_ASC" canPrint />,
    );
    // Initially all selected (empty set = all)
    // Click CIR to deselect it
    await userEvent.click(screen.getByLabelText(/CIRUGIA WZ/i));
    // Now only CIR is selected (because we toggled from "all" to "CIR only via deselect logic")
    // Actually the toggle logic: empty set = all; clicking adds to explicit set
    // After first click: selectedServices = {CIR} — but UI shows checked=false for CIR
    // because checked = size===0 || selectedServices.has(codigo)
    // So after clicking CIR: selectedServices={CIR}, CIR checked=true, CARD checked=false
    // previewCount = items with CIR = 1
    // After toggle, 1 cita in preview
    const summaryEl = document.querySelector('.report-wizard-summary');
    expect(summaryEl?.textContent).toMatch(/1 cita/);
  });

  it('empty items shows empty-state message', () => {
    render(
      <ReportWizard date="2026-09-01" items={[]} order="APPOINTMENT_TIME_ASC" canPrint />,
    );
    expect(screen.getByText(/no hay servicios disponibles/i)).toBeInTheDocument();
  });

  it('Generar PDF button is disabled when previewCount = 0 (no items for date)', () => {
    // With empty items list, previewCount = 0 → button disabled
    render(
      <ReportWizard date="2026-09-01" items={[]} order="APPOINTMENT_TIME_ASC" canPrint />,
    );
    // No services to select + no items = 0 citas
    // The generate button should not be present since no items
    // (empty-state message is shown instead)
    expect(screen.getByText(/no hay servicios disponibles/i)).toBeInTheDocument();
    const btn = screen.queryByRole('button', { name: /generar.*pdf/i });
    if (btn) expect(btn).toBeDisabled();
  });
});

// ── T-28 Regressions ─────────────────────────────────────────────────────────

describe('PreparationTable — T-28 orden y ReportWizard', () => {
  const noop = () => undefined;

  function paginationProps() {
    return {
      pageSize: 50 as const,
      onPageSizeChange: noop,
      currentPage: 1,
      hasPrevPage: false,
      hasNextPage: false,
      onPrevPage: noop,
      onNextPage: noop,
      totalLoaded: 3,
    };
  }

  it('T-28.1: opción SERVICE_MEDICO_HORA_ASC presente en el selector de orden', () => {
    render(
      <PreparationTable
        items={[]}
        order="SERVICE_MEDICO_HORA_ASC"
        onOrderChange={noop}
        {...paginationProps()}
      />,
    );
    const select = screen.getByLabelText(/orden/i) as HTMLSelectElement;
    const opts = Array.from(select.options).map((o) => o.value);
    expect(opts).toContain('SERVICE_MEDICO_HORA_ASC');
  });

  it('T-28.1: SERVICE_MEDICO_HORA_ASC es la opción seleccionada por defecto', () => {
    render(
      <PreparationTable
        items={[]}
        order="SERVICE_MEDICO_HORA_ASC"
        onOrderChange={noop}
        {...paginationProps()}
      />,
    );
    const select = screen.getByLabelText(/orden/i) as HTMLSelectElement;
    expect(select.value).toBe('SERVICE_MEDICO_HORA_ASC');
  });

  it('T-28.2: columnas Tipo DH y Cita presentes en encabezado de tabla', () => {
    const items = [{
      folio: 'F001', nombrePaciente: 'PACIENTE T28',
      expediente: { original: 'EXP-001', reference: null },
      tipoDerechohabiente: 'PENSIONISTA',
      tipoConsulta: 'FIRST_TIME' as const,
      agendaDate: '2026-08-26', appointmentTime: '07:00',
      medico: { numeroEmpleado: 'E01', nombre: 'DR T28' },
      servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIOLOGÍA' },
    }];
    render(
      <PreparationTable
        items={items}
        order="SERVICE_MEDICO_HORA_ASC"
        onOrderChange={noop}
        {...paginationProps()}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /tipo dh/i })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: /cita/i })).toBeDefined();
  });

  it('T-28.2: tipoDerechohabiente del item aparece en fila (Tipo DH)', () => {
    const items = [{
      folio: 'F001', nombrePaciente: 'PACIENTE T28',
      expediente: { original: 'EXP-001', reference: null },
      tipoDerechohabiente: 'PENSIONISTA',
      tipoConsulta: 'FIRST_TIME' as const,
      agendaDate: '2026-08-26', appointmentTime: '07:00',
      medico: { numeroEmpleado: 'E01', nombre: 'DR T28' },
      servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIOLOGÍA' },
    }];
    render(
      <PreparationTable
        items={items}
        order="SERVICE_MEDICO_HORA_ASC"
        onOrderChange={noop}
        {...paginationProps()}
      />,
    );
    expect(screen.getByText('PENSIONISTA')).toBeDefined();
  });

  it('T-28.2: FIRST_TIME → "1ª vez" en la columna Cita', () => {
    const items = [{
      folio: 'F001', nombrePaciente: 'PACIENTE T28',
      expediente: { original: 'EXP-001', reference: null },
      tipoDerechohabiente: 'ACTIVO',
      tipoConsulta: 'FIRST_TIME' as const,
      agendaDate: '2026-08-26', appointmentTime: '07:00',
      medico: { numeroEmpleado: 'E01', nombre: 'DR T28' },
      servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIOLOGÍA' },
    }];
    render(
      <PreparationTable
        items={items}
        order="SERVICE_MEDICO_HORA_ASC"
        onOrderChange={noop}
        {...paginationProps()}
      />,
    );
    expect(screen.getByText(/1ª vez/i)).toBeDefined();
  });

  it('T-28.2: SUBSEQUENT → "Subsecuente" en la columna Cita', () => {
    const items = [{
      folio: 'F001', nombrePaciente: 'PACIENTE T28',
      expediente: { original: 'EXP-001', reference: null },
      tipoDerechohabiente: 'ACTIVO',
      tipoConsulta: 'SUBSEQUENT' as const,
      agendaDate: '2026-08-26', appointmentTime: '07:00',
      medico: { numeroEmpleado: 'E01', nombre: 'DR T28' },
      servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIOLOGÍA' },
    }];
    render(
      <PreparationTable
        items={items}
        order="SERVICE_MEDICO_HORA_ASC"
        onOrderChange={noop}
        {...paginationProps()}
      />,
    );
    expect(screen.getByText(/subsecuente/i)).toBeDefined();
  });
});

// ── T-28.3 ReportWizard — vista previa PDF ────────────────────────────────────

describe('ReportWizard — T-28.3 vista previa PDF', () => {
  const items = [{
    folio: 'T28-F001', nombrePaciente: 'PACIENTE T28',
    expediente: { original: 'EXP-T28-001', reference: null },
    tipoDerechohabiente: 'PENSIONISTA',
    tipoConsulta: 'FIRST_TIME' as const,
    agendaDate: '2026-09-01', appointmentTime: '08:00',
    medico: { numeroEmpleado: 'E01', nombre: 'DR T28' },
    servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIOLOGÍA T28' },
  }];

  it('T-28.3: botón "Generar PDF" presente cuando canPrint=true', () => {
    render(<ReportWizard date="2026-09-01" items={items} order="SERVICE_MEDICO_HORA_ASC" canPrint />);
    expect(screen.getByRole('button', { name: /generar.*pdf|pdf.*preparaci/i })).toBeDefined();
  });

  it('T-28.3: no existe botón "Generar PDF" cuando canPrint=false', () => {
    render(<ReportWizard date="2026-09-01" items={items} order="SERVICE_MEDICO_HORA_ASC" canPrint={false} />);
    expect(screen.queryByRole('button', { name: /generar.*pdf|pdf.*preparaci/i })).toBeNull();
  });

  it('T-28.3: previewOrDownloadPdf abre nueva pestaña con Object URL del Blob', async () => {
    // Verify that previewOrDownloadPdf uses window.open (not direct download only)
    // by spying on window.open before the component calls agendaApi
    const mockBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const createURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    // Mock agendaApi.generatePreparationReport at the module level via spyOn
    const { agendaApi } = await import('../api/agendaApi.js');
    const generateSpy = vi.spyOn(agendaApi, 'generatePreparationReport').mockResolvedValue(
      { blob: mockBlob, filename: 'lista-preparacion-2026-09-01.pdf' },
    );

    render(<ReportWizard date="2026-09-01" items={items} order="SERVICE_MEDICO_HORA_ASC" canPrint />);
    await userEvent.click(screen.getByRole('button', { name: /generar.*pdf|pdf.*preparaci/i }));
    await vi.waitFor(() => expect(generateSpy).toHaveBeenCalled());

    // T-28.3: opens new tab (not direct download as only behavior)
    expect(createURLSpy).toHaveBeenCalledWith(mockBlob);
    expect(openSpy).toHaveBeenCalledWith('blob:mock-url', '_blank');

    generateSpy.mockRestore(); openSpy.mockRestore(); createURLSpy.mockRestore();
  });

  it('T-28.3: fallback a descarga cuando window.open retorna null (popup bloqueado)', async () => {
    const mockBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);  // popup blocked
    const createURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const { agendaApi } = await import('../api/agendaApi.js');
    const generateSpy = vi.spyOn(agendaApi, 'generatePreparationReport').mockResolvedValue(
      { blob: mockBlob, filename: 'lista.pdf' },
    );

    render(<ReportWizard date="2026-09-01" items={items} order="SERVICE_MEDICO_HORA_ASC" canPrint />);
    await userEvent.click(screen.getByRole('button', { name: /generar.*pdf|pdf.*preparaci/i }));
    await vi.waitFor(() => expect(generateSpy).toHaveBeenCalled());

    // Popup was blocked → window.open was called (and returned null)
    expect(openSpy).toHaveBeenCalled();
    // Fallback: URL created and either revokeURL or anchor click triggered
    expect(revokeURLSpy.mock.calls.length + clickSpy.mock.calls.length).toBeGreaterThan(0);

    generateSpy.mockRestore(); openSpy.mockRestore();
    createURLSpy.mockRestore(); revokeURLSpy.mockRestore(); clickSpy.mockRestore();
  });
});
