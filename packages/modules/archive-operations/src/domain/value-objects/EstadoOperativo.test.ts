/**
 * Tests para EstadoOperativo — T-01
 * Fuente: DDD-012 v0.2.0, INV-EXP-004, DEC-EW-STATE-001, TQ-003 v0.2.0
 */

import { describe, expect, it } from 'vitest';
import { DomainError } from '@sigac/domain-kernel';
import {
  ESTADOS_OPERATIVOS_VALIDOS,
  isEstadoOperativo,
  parseEstadoOperativo,
} from './EstadoOperativo.js';

describe('EstadoOperativo', () => {
  describe('parseEstadoOperativo — valores válidos (DEC-EW-STATE-001)', () => {
    it.each(ESTADOS_OPERATIVOS_VALIDOS)('acepta "%s"', (estado) => {
      expect(() => parseEstadoOperativo(estado)).not.toThrow();
      expect(parseEstadoOperativo(estado)).toBe(estado);
    });

    it('acepta DISPONIBLE', () => {
      expect(parseEstadoOperativo('DISPONIBLE')).toBe('DISPONIBLE');
    });

    it('acepta APARTADO', () => {
      expect(parseEstadoOperativo('APARTADO')).toBe('APARTADO');
    });

    it('acepta EN_TRASLADO', () => {
      expect(parseEstadoOperativo('EN_TRASLADO')).toBe('EN_TRASLADO');
    });

    it('acepta EN_CONSULTA', () => {
      expect(parseEstadoOperativo('EN_CONSULTA')).toBe('EN_CONSULTA');
    });

    it('acepta NO_LOCALIZADO', () => {
      expect(parseEstadoOperativo('NO_LOCALIZADO')).toBe('NO_LOCALIZADO');
    });

    it('acepta EXTRAVIADO', () => {
      expect(parseEstadoOperativo('EXTRAVIADO')).toBe('EXTRAVIADO');
    });
  });

  describe('parseEstadoOperativo — valores rechazados', () => {
    it('rechaza EN_BUSQUEDA (pertenece a Solicitud, no a Expediente)', () => {
      expect(() => parseEstadoOperativo('EN_BUSQUEDA')).toThrow(DomainError);
    });

    it('el error de EN_BUSQUEDA menciona que pertenece a Solicitud', () => {
      expect(() => parseEstadoOperativo('EN_BUSQUEDA')).toThrow(/Solicitud/);
    });

    it('rechaza PRESTADO (pertenece a Préstamo, no a Expediente)', () => {
      expect(() => parseEstadoOperativo('PRESTADO')).toThrow(DomainError);
    });

    it('el error de PRESTADO menciona que pertenece a Préstamo', () => {
      expect(() => parseEstadoOperativo('PRESTADO')).toThrow(/Préstamo/);
    });

    it('rechaza PREPARACION (estado antiguo no aprobado)', () => {
      expect(() => parseEstadoOperativo('PREPARACION')).toThrow(DomainError);
    });

    it('rechaza TRASLADO (forma antigua; el valor correcto es EN_TRASLADO)', () => {
      expect(() => parseEstadoOperativo('TRASLADO')).toThrow(DomainError);
    });

    it('rechaza CUSTODIA_EXTERNA (estado antiguo no aprobado)', () => {
      expect(() => parseEstadoOperativo('CUSTODIA_EXTERNA')).toThrow(DomainError);
    });

    it('rechaza INCIDENCIA (estado antiguo no aprobado)', () => {
      expect(() => parseEstadoOperativo('INCIDENCIA')).toThrow(DomainError);
    });

    it('rechaza cadena vacía', () => {
      expect(() => parseEstadoOperativo('')).toThrow(DomainError);
    });

    it('rechaza valor arbitrario', () => {
      expect(() => parseEstadoOperativo('INVENTADO')).toThrow(DomainError);
    });

    it('el DomainError tiene code ESTADO_OPERATIVO_INVALIDO para valor desconocido', () => {
      try {
        parseEstadoOperativo('INVENTADO');
        expect.fail('Debería haber lanzado');
      } catch (e) {
        expect(e).toBeInstanceOf(DomainError);
        expect((e as DomainError).code).toBe('ESTADO_OPERATIVO_INVALIDO');
      }
    });
  });

  describe('isEstadoOperativo — type guard', () => {
    it('retorna true para DISPONIBLE', () => {
      expect(isEstadoOperativo('DISPONIBLE')).toBe(true);
    });

    it('retorna false para EN_BUSQUEDA', () => {
      expect(isEstadoOperativo('EN_BUSQUEDA')).toBe(false);
    });

    it('retorna false para PRESTADO', () => {
      expect(isEstadoOperativo('PRESTADO')).toBe(false);
    });

    it('retorna false para valor desconocido', () => {
      expect(isEstadoOperativo('INVENTADO')).toBe(false);
    });
  });

  describe('catálogo completo', () => {
    it('contiene exactamente 6 valores (DEC-EW-STATE-001)', () => {
      expect(ESTADOS_OPERATIVOS_VALIDOS).toHaveLength(6);
    });

    it('no contiene EN_BUSQUEDA', () => {
      expect(ESTADOS_OPERATIVOS_VALIDOS).not.toContain('EN_BUSQUEDA');
    });

    it('no contiene PRESTADO', () => {
      expect(ESTADOS_OPERATIVOS_VALIDOS).not.toContain('PRESTADO');
    });
  });
});
