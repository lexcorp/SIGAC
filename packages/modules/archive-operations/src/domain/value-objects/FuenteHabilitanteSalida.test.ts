import { describe, expect, it } from 'vitest';
import { DomainError } from '@sigac/domain-kernel';
import {
  FUENTES_HABILITANTES_SALIDA,
  isFuenteHabilitanteSalida,
  parseFuenteHabilitanteSalida,
} from './FuenteHabilitanteSalida.js';

describe('FuenteHabilitanteSalida', () => {
  it.each(FUENTES_HABILITANTES_SALIDA)('acepta "%s"', (fuente) => {
    expect(parseFuenteHabilitanteSalida(fuente)).toBe(fuente);
    expect(isFuenteHabilitanteSalida(fuente)).toBe(true);
  });

  it('contiene exactamente los tres valores aprobados', () => {
    expect(FUENTES_HABILITANTES_SALIDA).toEqual([
      'CONSULTA_PROGRAMADA',
      'VALE_ARCHIVO_SM_1_14',
      'ORDEN_SUPERIOR',
    ]);
  });

  it('rechaza una fuente no aprobada', () => {
    expect(() => parseFuenteHabilitanteSalida('AUTORIZACION_VERBAL')).toThrow(DomainError);
    expect(isFuenteHabilitanteSalida('AUTORIZACION_VERBAL')).toBe(false);
  });
});
