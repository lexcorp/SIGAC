import { DomainError } from '@sigac/domain-kernel';
import { describe, expect, it } from 'vitest';
import { AgendaFecha, FolioCita, NumeroEmpleado, PosicionRegistroOrigen, ServicioEspecialidad } from './index.js';

function expectDomainError(action: () => unknown, code: string): void {
  try { action(); } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`Expected DomainError ${code}`);
}

describe('AgendaFecha', () => {
  it('accepts canonical valid Gregorian civil dates', () => {
    expect(AgendaFecha.parse('2024-02-29').value).toBe('2024-02-29');
    expect(AgendaFecha.parse('2026-08-21').toString()).toBe('2026-08-21');
  });
  it.each(['2023-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '21/08/2026', '2026-08-21T00:00:00Z', ' 2026-08-21 '])('rejects non-canonical or invalid date %s', value => {
    expectDomainError(() => AgendaFecha.parse(value), 'AGENDA_FECHA_INVALID');
  });
});

describe('FolioCita', () => {
  it('trims only exterior whitespace and preserves exact semantics', () => {
    const folio = FolioCita.parse('  00ab/ 01-X  ');
    expect(folio.value).toBe('00ab/ 01-X');
    expect(folio.equals(FolioCita.parse('00ab/ 01-X'))).toBe(true);
    expect(folio.equals(FolioCita.parse('00AB/ 01-X'))).toBe(false);
  });
  it.each(['', '   '])('rejects empty value', value => expectDomainError(() => FolioCita.parse(value), 'FOLIO_CITA_INVALID'));
});

describe('NumeroEmpleado', () => {
  it('trims only exterior whitespace and preserves leading zeros', () => {
    const numero = NumeroEmpleado.parse('  0012-A  ');
    expect(numero.value).toBe('0012-A');
    expect(numero.equals(NumeroEmpleado.parse('0012-A'))).toBe(true);
    expect(numero.equals(NumeroEmpleado.parse('12-A'))).toBe(false);
  });
  it.each(['', '\t '])('rejects empty value', value => expectDomainError(() => NumeroEmpleado.parse(value), 'NUMERO_EMPLEADO_INVALID'));
});

describe('ServicioEspecialidad', () => {
  it('trims exterior whitespace and uses codigo as identity', () => {
    const servicio = ServicioEspecialidad.create({ codigo: '  010-A  ', nombre: '  Cardiología Pediátrica  ' });
    expect(servicio.codigo).toBe('010-A');
    expect(servicio.nombre).toBe('Cardiología Pediátrica');
    expect(servicio.equals(ServicioEspecialidad.create({ codigo: '010-A', nombre: 'Otro nombre' }))).toBe(true);
    expect(servicio.equals(ServicioEspecialidad.create({ codigo: '010-a', nombre: 'Cardiología Pediátrica' }))).toBe(false);
  });
  it.each([{ codigo: '', nombre: 'Nombre' }, { codigo: 'C', nombre: '  ' }])('rejects missing component', props => expectDomainError(() => ServicioEspecialidad.create(props), 'SERVICIO_ESPECIALIDAD_INVALID'));
});

describe('PosicionRegistroOrigen', () => {
  it('represents a positive base-1 logical ordinal', () => {
    expect(PosicionRegistroOrigen.create(1).value).toBe(1);
    expect(PosicionRegistroOrigen.create(7).equals(PosicionRegistroOrigen.create(7))).toBe(true);
  });
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', value => expectDomainError(() => PosicionRegistroOrigen.create(value), 'POSICION_REGISTRO_ORIGEN_INVALID'));
});

describe('provenance boundary', () => {
  it('does not store original/normalized pairs or parser concerns in value objects', () => {
    expect(Object.keys(FolioCita.parse(' F-01 '))).toEqual(['value']);
    expect(Object.keys(AgendaFecha.parse('2026-08-21'))).toEqual(['value']);
  });
});
