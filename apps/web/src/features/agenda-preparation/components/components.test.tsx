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
