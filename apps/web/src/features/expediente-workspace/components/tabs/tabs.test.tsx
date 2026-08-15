import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readModel } from '../../expediente.fixtures';
import type { MovimientoExpedienteSummary } from '../../types/expediente.types';
import { MovimientosTab } from './MovimientosTab';
import { ResumenTab } from './ResumenTab';
import { WorkspaceTabs } from './WorkspaceTabs';

const movements: readonly MovimientoExpedienteSummary[] = [
  { movimientoId: 'm1', movementType: 'DISPATCHED', originLocation: 'a', destinationLocation: 'b', originCustodianRef: null, destinationCustodianRef: 'r1', businessReferenceType: 'VALE', businessReferenceId: null, occurredAt: '2026-08-15T10:00:00Z', recordedAt: '2026-08-15T10:00:01Z', actorRef: 'actor', source: 'WEB', correlationId: 'corr' },
  { movimientoId: 'm2', movementType: 'CUSTODY_ACCEPTED', originLocation: 'b', destinationLocation: 'b', originCustodianRef: 'r1', destinationCustodianRef: 'r2', businessReferenceType: 'VALE', businessReferenceId: 'v1', occurredAt: '2026-08-15T11:00:00Z', recordedAt: '2026-08-15T11:00:01Z', actorRef: 'actor', source: 'WEB', correlationId: 'corr' },
];

describe('tabs del Workspace', () => {
  it('Resumen muestra aceptación sólo en EN_CONSULTA', () => {
    const custody = { custodioTipo: 'MEDICO', custodioRef: 'r2', servicio: null, aceptadaEn: '2026-08-15T11:00:00Z' };
    const { rerender } = render(<ResumenTab expediente={readModel({ estadoOperativo: 'EN_TRASLADO', custodiaActual: custody })} />);
    expect(screen.queryByText('Aceptada')).not.toBeInTheDocument();
    rerender(<ResumenTab expediente={readModel({ estadoOperativo: 'EN_CONSULTA', custodiaActual: custody })} />);
    expect(screen.getByText('Aceptada')).toBeInTheDocument();
  });

  it('Movimientos mantiene timeline separado de audit y expone paginación', async () => {
    const loadMore = vi.fn();
    render(<MovimientosTab items={movements} nextCursor="opaque.cursor" onLoadMore={loadMore} />);
    expect(screen.getByText('DISPATCHED')).toBeInTheDocument();
    expect(screen.getByText('CUSTODY_ACCEPTED')).toBeInTheDocument();
    expect(screen.queryByText(/login|configuración/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Cargar más/ }));
    expect(loadMore).toHaveBeenCalledOnce();
  });

  it('presenta loading, empty y error', () => {
    const { rerender } = render(<MovimientosTab items={[]} loading nextCursor={null} onLoadMore={vi.fn()} />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    rerender(<MovimientosTab items={[]} nextCursor={null} onLoadMore={vi.fn()} />);
    expect(screen.getByText('No hay movimientos registrados.')).toBeInTheDocument();
    rerender(<MovimientosTab items={[]} error nextCursor={null} onLoadMore={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('oculta Auditoría fail-closed y permite navegación de tabs por teclado', async () => {
    render(<WorkspaceTabs expediente={readModel()} movimientos={[]} timelineNextCursor={null} onLoadMore={vi.fn()} />);
    expect(screen.queryByRole('tab', { name: 'Auditoría' })).not.toBeInTheDocument();
    const resumen = screen.getByRole('tab', { name: 'Resumen' });
    resumen.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toHaveFocus();
  });
});
