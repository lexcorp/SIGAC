import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readModel, searchItem } from '../expediente.fixtures';
import { ESTADOS_OPERATIVOS, type EstadoOperativo } from '../types/expediente.types';
import { CommandBar } from './CommandBar';
import { ConflictBanner } from './ConflictBanner';
import { DisambiguationList } from './DisambiguationList';
import { ExpedienteHeader } from './ExpedienteHeader';
import { DispatchExpedienteDialog } from './DispatchExpedienteDialog';
import { AcceptCustodyDialog } from './AcceptCustodyDialog';

describe('ExpedienteHeader', () => {
  it.each(ESTADOS_OPERATIVOS)('renderiza el estado canónico %s', (estado) => {
    render(<ExpedienteHeader expediente={readModel({ estadoOperativo: estado })} />);
    expect(screen.getByText(estado)).toBeInTheDocument();
  });

  it('rechaza un estado que no pertenece a EstadoOperativo', () => {
    const { container } = render(<ExpedienteHeader expediente={readModel({ estadoOperativo: 'EN_BUSQUEDA' as EstadoOperativo })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra acceptedAt sólo durante EN_CONSULTA', () => {
    const custody = { custodioTipo: 'MEDICO', custodioRef: 'receiver-1', servicio: null, aceptadaEn: '2026-08-15T10:00:00.000Z' };
    const { rerender } = render(<ExpedienteHeader expediente={readModel({ estadoOperativo: 'EN_TRASLADO', custodiaActual: custody })} />);
    expect(screen.queryByText(/Aceptada:/)).not.toBeInTheDocument();
    rerender(<ExpedienteHeader expediente={readModel({ estadoOperativo: 'EN_CONSULTA', custodiaActual: custody })} />);
    expect(screen.getByText(/Aceptada:/)).toBeInTheDocument();
  });

  it('ofrece estados loading y empty sin contenido clínico', () => {
    const { rerender } = render(<ExpedienteHeader loading />);
    expect(screen.getByLabelText('Cargando expediente')).toHaveAttribute('aria-busy', 'true');
    rerender(<ExpedienteHeader expediente={null} />);
    expect(screen.getByText(/Selecciona un expediente/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/diagnóstico|tratamiento|nota clínica/i);
  });
});

describe('DisambiguationList', () => {
  it('sólo aparece para N > 1 y nunca selecciona automáticamente', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<DisambiguationList items={[]} onSelect={onSelect} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    rerender(<DisambiguationList items={[searchItem('one')]} onSelect={onSelect} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    rerender(<DisambiguationList items={[searchItem('one'), searchItem('two')]} onSelect={onSelect} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.setup().tab();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('one');
  });
});

describe('CommandBar', () => {
  it.each([
    [['SOLICITAR'] as const, 'Solicitar'],
    [['DISPATCH'] as const, 'Despachar'],
    [['ABRIR_PRESTAMO'] as const, 'Abrir préstamo'],
  ])('renderiza sólo la capability recibida', (capabilities, label) => {
    render(<CommandBar capabilities={capabilities} onCommand={vi.fn()} />);
    expect(screen.getByRole('button', { name: label })).toBeEnabled();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('no inventa acciones y soporta teclado/estado pending', async () => {
    const onCommand = vi.fn();
    const { rerender } = render(<CommandBar capabilities={[]} onCommand={onCommand} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    rerender(<CommandBar capabilities={['SOLICITAR']} onCommand={onCommand} />);
    await userEvent.setup().tab();
    await userEvent.keyboard('{Enter}');
    expect(onCommand).toHaveBeenCalledWith('SOLICITAR');
    rerender(<CommandBar capabilities={['SOLICITAR']} pendingCapability="SOLICITAR" onCommand={onCommand} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

it('mantiene visible el conflicto hasta que el usuario solicita recarga', async () => {
  const reload = vi.fn();
  render(<ConflictBanner visible onReload={reload} />);
  expect(screen.getByRole('alert')).toHaveTextContent('El expediente cambió');
  await userEvent.click(screen.getByRole('button', { name: 'Recargar' }));
  expect(reload).toHaveBeenCalledOnce();
});

describe('command dialogs T-21A', () => {
  const locations = [{ id: '11111111-1111-4111-8111-111111111111', codigo: 'CONS-1', descripcion: 'Consultorio' }];

  it('Dispatch selecciona ubicación, preserva rowVersion string y emite payload exacto', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined); const onClose = vi.fn();
    const { container } = render(<DispatchExpedienteDialog locations={locations} rowVersion="9007199254740993" onSubmit={onSubmit} onClose={onClose} />);
    await userEvent.selectOptions(screen.getByLabelText('Destino'), locations[0]!.id);
    await userEvent.type(screen.getByLabelText('Tipo de custodio previsto'), 'SERVICIO');
    await userEvent.type(screen.getByLabelText('Referencia de custodio previsto'), 'receptor-1');
    await userEvent.type(screen.getByLabelText('Tipo de referencia de negocio'), 'VALE');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar despacho' }));
    expect(onSubmit).toHaveBeenCalledWith({ destination: locations[0], intendedCustodian: { type: 'SERVICIO', reference: 'receptor-1' }, businessReference: { type: 'VALE', id: null } });
    expect(container.querySelector('input[name="expectedRowVersion"]')).toHaveValue('9007199254740993');
    expect(screen.queryByRole('textbox', { name: /UUID/i })).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('AcceptCustody usa receptor efectivo, service nullable y cierra después de success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined); const onClose = vi.fn();
    render(<AcceptCustodyDialog locations={locations} rowVersion="43" onSubmit={onSubmit} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText('Receptor tipo'), 'MEDICO');
    await userEvent.type(screen.getByLabelText('Receptor referencia'), 'receptor-2');
    await userEvent.selectOptions(screen.getByLabelText('Ubicación destino'), locations[0]!.id);
    await userEvent.type(screen.getByLabelText('Tipo de referencia de negocio'), 'VALE');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }));
    expect(onSubmit).toHaveBeenCalledWith({ receptor: { type: 'MEDICO', reference: 'receptor-2', service: null }, ubicacionDestino: locations[0], businessReference: { type: 'VALE', id: null } });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
