import { DomainError } from '@sigac/domain-kernel';
import { describe, expect, it } from 'vitest';
import {
  ExpedienteReferencia,
  HoraCita,
  MedicoReferencia,
  NumeroEmpleado,
} from './index.js';

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

describe('HoraCita', () => {
  it.each(['00:00', '08:05', '23:59'])('accepts canonical 24-hour time %s', value => {
    expect(HoraCita.parse(value).value).toBe(value);
  });

  it.each(['', ' 08:05 ', '8:05', '24:00', '23:60', '08:05:00', '08:05Z'])('rejects %s', value => {
    expectDomainError(() => HoraCita.parse(value), 'HORA_CITA_INVALID');
  });
});

describe('MedicoReferencia', () => {
  it('uses employee number as identity and keeps the name descriptive', () => {
    const numero = NumeroEmpleado.parse('00123');
    const medico = MedicoReferencia.create({ numeroEmpleado: numero, nombre: '  Dra. Álvarez  ' });
    const renamed = MedicoReferencia.create({ numeroEmpleado: numero, nombre: 'Dra. A. Álvarez' });

    expect(medico.nombre).toBe('Dra. Álvarez');
    expect(medico.equals(renamed)).toBe(true);
    expect(medico.equals(MedicoReferencia.create({
      numeroEmpleado: NumeroEmpleado.parse('00124'),
      nombre: 'Dra. Álvarez',
    }))).toBe(false);
  });

  it('rejects a missing descriptive name', () => {
    expectDomainError(
      () => MedicoReferencia.create({ numeroEmpleado: NumeroEmpleado.parse('00123'), nombre: '  ' }),
      'MEDICO_REFERENCIA_INVALID',
    );
  });
});

describe('ExpedienteReferencia', () => {
  it('is an opaque exact string after exterior trim', () => {
    const reference = ExpedienteReferencia.parse('  00-ab/ 12  ');
    expect(reference.value).toBe('00-ab/ 12');
    expect(reference.equals(ExpedienteReferencia.parse('00-ab/ 12'))).toBe(true);
    expect(reference.equals(ExpedienteReferencia.parse('00-AB/ 12'))).toBe(false);
  });

  it.each(['', '   '])('rejects an empty reference', value => {
    expectDomainError(() => ExpedienteReferencia.parse(value), 'EXPEDIENTE_REFERENCIA_INVALID');
  });
});
