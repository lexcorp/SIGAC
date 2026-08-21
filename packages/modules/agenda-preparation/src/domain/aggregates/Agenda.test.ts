import { DomainError } from '@sigac/domain-kernel';
import { describe, expect, it } from 'vitest';
import { Cita, type CitaSnapshot } from '../entities/index.js';
import {
  AgendaFecha,
  ExpedienteReferencia,
  FolioCita,
  HoraCita,
  MedicoReferencia,
  NumeroEmpleado,
  ServicioEspecialidad,
} from '../value-objects/index.js';
import { Agenda } from './Agenda.js';

const FECHA = AgendaFecha.parse('2026-08-21');

function snapshot(folio: string, overrides: Partial<CitaSnapshot> = {}): CitaSnapshot {
  return {
    folio: FolioCita.parse(folio),
    agendaFecha: FECHA,
    hora: HoraCita.parse('08:00'),
    expedienteReference: ExpedienteReferencia.parse(`EXP-${folio}`),
    nombrePaciente: `Paciente ${folio}`,
    tipoDerechohabiente: 'TRABAJADOR',
    tipoConsulta: 'FIRST_TIME',
    medico: MedicoReferencia.create({
      numeroEmpleado: NumeroEmpleado.parse('0007'),
      nombre: 'Dra. Ejemplo',
    }),
    servicioEspecialidad: ServicioEspecialidad.create({
      codigo: 'CARD',
      nombre: 'Cardiología',
    }),
    ...overrides,
  };
}

function expectDomainError(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`Expected DomainError ${code}`);
}

function values(folios: readonly FolioCita[]): string[] {
  return folios.map(folio => folio.value);
}

describe('Cita', () => {
  it('creates an active appointment with exactly the approved semantic fields', () => {
    const cita = Cita.create(snapshot('F-01', {
      nombrePaciente: '  Persona Sintética  ',
      tipoDerechohabiente: '  PENSIONADO  ',
      expedienteReference: null,
      tipoConsulta: 'SUBSEQUENT',
    }));

    expect(cita.nombrePaciente).toBe('Persona Sintética');
    expect(cita.tipoDerechohabiente).toBe('PENSIONADO');
    expect(cita.expedienteReference).toBeNull();
    expect(cita.tipoConsulta).toBe('SUBSEQUENT');
    expect(cita.lifecycle).toBe('ACTIVA');
    for (const excluded of [
      'curp', 'telefono', 'vigencia', 'sexo', 'edad', 'turno', 'consultorio',
      'destino', 'createdAt', 'updatedAt', 'withdrawnAt', 'restoredAt', 'domainEvents',
    ]) {
      expect(excluded in cita).toBe(false);
    }
  });

  it.each([
    { nombrePaciente: ' ' },
    { tipoDerechohabiente: '' },
    { tipoConsulta: 'OTHER' },
  ])('rejects invalid Cita shape %#', override => {
    expectDomainError(
      () => Cita.create(snapshot('F-01', override as Partial<CitaSnapshot>)),
      'CITA_INVALID',
    );
  });
});

describe('Agenda', () => {
  it('can be created empty without AgendaId or tenant infrastructure', () => {
    const agenda = Agenda.create({ fecha: FECHA });
    expect(agenda.fecha).toBe(FECHA);
    expect(agenda.citas).toEqual([]);
    expect('id' in agenda).toBe(false);
    expect('tenant' in agenda).toBe(false);
    expect('tenantContext' in agenda).toBe(false);
  });

  it('accepts initial appointments and validates duplicate FOLIO and date', () => {
    const first = Cita.create(snapshot('F-01'));
    const second = Cita.create(snapshot('F-02'));
    expect(Agenda.create({ fecha: FECHA, citasIniciales: [first, second] }).citas).toEqual([first, second]);

    expectDomainError(
      () => Agenda.create({ fecha: FECHA, citasIniciales: [first, Cita.create(snapshot('F-01'))] }),
      'AGENDA_FOLIO_DUPLICADO',
    );
    expectDomainError(
      () => Agenda.create({
        fecha: FECHA,
        citasIniciales: [Cita.create(snapshot('F-03', { agendaFecha: AgendaFecha.parse('2026-08-22') }))],
      }),
      'AGENDA_FECHA_INCOMPATIBLE',
    );
  });

  it('reconciles a complete ADD/UPDATE/UNCHANGED/RESTORE/WITHDRAW table', () => {
    const unchanged = Cita.create(snapshot('F-01'));
    const updated = Cita.create(snapshot('F-02'));
    const withdrawn = Cita.create(snapshot('F-03'));
    const restored = Cita.create(snapshot('F-04'));
    const agenda = Agenda.create({ fecha: FECHA, citasIniciales: [unchanged, updated, withdrawn, restored] });

    agenda.reconcile({ incoming: [snapshot('F-01'), snapshot('F-02'), snapshot('F-03')] });
    expect(restored.lifecycle).toBe('RETIRADA_DE_AGENDA');

    const result = agenda.reconcile({ incoming: [
      snapshot('F-01'),
      snapshot('F-02', { hora: HoraCita.parse('09:30') }),
      snapshot('F-04', { nombrePaciente: 'Paciente restaurado' }),
      snapshot('F-05'),
    ] });

    expect(values(result.added)).toEqual(['F-05']);
    expect(values(result.updated)).toEqual(['F-02']);
    expect(values(result.unchanged)).toEqual(['F-01']);
    expect(values(result.restored)).toEqual(['F-04']);
    expect(values(result.withdrawn)).toEqual(['F-03']);
    expect(updated.hora.value).toBe('09:30');
    expect(withdrawn.lifecycle).toBe('RETIRADA_DE_AGENDA');
    expect(restored.lifecycle).toBe('ACTIVA');
    expect(restored.nombrePaciente).toBe('Paciente restaurado');
  });

  it('compares every approved functional field and nothing external', () => {
    const cases: Partial<CitaSnapshot>[] = [
      { hora: HoraCita.parse('08:01') },
      { expedienteReference: ExpedienteReferencia.parse('OTHER') },
      { nombrePaciente: 'Otro nombre' },
      { tipoDerechohabiente: 'PENSIONADO' },
      { tipoConsulta: 'SUBSEQUENT' },
      { medico: MedicoReferencia.create({ numeroEmpleado: NumeroEmpleado.parse('8'), nombre: 'Dra. Ejemplo' }) },
      { medico: MedicoReferencia.create({ numeroEmpleado: NumeroEmpleado.parse('0007'), nombre: 'Otro nombre' }) },
      { servicioEspecialidad: ServicioEspecialidad.create({ codigo: 'NEU', nombre: 'Cardiología' }) },
      { servicioEspecialidad: ServicioEspecialidad.create({ codigo: 'CARD', nombre: 'Cardiología pediátrica' }) },
    ];

    for (const changed of cases) {
      const agenda = Agenda.create({ fecha: FECHA, citasIniciales: [Cita.create(snapshot('F-01'))] });
      expect(values(agenda.reconcile({ incoming: [snapshot('F-01', changed)] }).updated)).toEqual(['F-01']);
    }
  });

  it('withdraws every active appointment for an empty snapshot without duplicating effects', () => {
    const first = Cita.create(snapshot('F-01'));
    const second = Cita.create(snapshot('F-02'));
    const agenda = Agenda.create({ fecha: FECHA, citasIniciales: [first, second] });

    expect(values(agenda.reconcile({ incoming: [] }).withdrawn)).toEqual(['F-01', 'F-02']);
    expect(first.lifecycle).toBe('RETIRADA_DE_AGENDA');
    expect(second.lifecycle).toBe('RETIRADA_DE_AGENDA');
    expect(agenda.reconcile({ incoming: [] }).withdrawn).toEqual([]);
    expect(agenda.citas).toEqual([first, second]);
  });

  it('restores the same logical entity and preserves content while withdrawn', () => {
    const original = Cita.create(snapshot('F-01'));
    const agenda = Agenda.create({ fecha: FECHA, citasIniciales: [original] });

    agenda.reconcile({ incoming: [] });
    expect(original.nombrePaciente).toBe('Paciente F-01');
    expect(original.lifecycle).toBe('RETIRADA_DE_AGENDA');
    expect((original.lifecycle as string)).not.toBe('CANCELADA');

    agenda.reconcile({ incoming: [snapshot('F-01', { nombrePaciente: 'Nombre actualizado' })] });
    expect(agenda.citas[0]).toBe(original);
    expect(original.lifecycle).toBe('ACTIVA');
    expect(original.nombrePaciente).toBe('Nombre actualizado');
  });

  it('rejects duplicate FOLIO atomically with zero mutation', () => {
    const original = Cita.create(snapshot('F-01'));
    const agenda = Agenda.create({ fecha: FECHA, citasIniciales: [original] });

    expectDomainError(
      () => agenda.reconcile({ incoming: [snapshot('F-01', { hora: HoraCita.parse('10:00') }), snapshot('F-01')] }),
      'AGENDA_FOLIO_DUPLICADO',
    );
    expect(agenda.citas).toEqual([original]);
    expect(original.hora.value).toBe('08:00');
    expect(original.lifecycle).toBe('ACTIVA');
  });

  it('rejects incompatible date atomically with zero mutation', () => {
    const original = Cita.create(snapshot('F-01'));
    const agenda = Agenda.create({ fecha: FECHA, citasIniciales: [original] });

    expectDomainError(
      () => agenda.reconcile({ incoming: [
        snapshot('F-01', { hora: HoraCita.parse('10:00') }),
        snapshot('F-02', { agendaFecha: AgendaFecha.parse('2026-08-22') }),
      ] }),
      'AGENDA_FECHA_INCOMPATIBLE',
    );
    expect(agenda.citas).toEqual([original]);
    expect(original.hora.value).toBe('08:00');
    expect(original.lifecycle).toBe('ACTIVA');
  });

  it('rejects a malformed reconciliation command without mutation', () => {
    const original = Cita.create(snapshot('F-01'));
    const agenda = Agenda.create({ fecha: FECHA, citasIniciales: [original] });
    expectDomainError(
      () => agenda.reconcile(undefined as unknown as { incoming: readonly CitaSnapshot[] }),
      'AGENDA_RECONCILIACION_INVALIDA',
    );
    expect(agenda.citas).toEqual([original]);
  });
});
