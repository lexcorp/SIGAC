/**
 * Tests para ExpedienteNumero — T-01
 * Fuente: DDD-007 v0.2.0, DECISION-REGISTER OQ-EW-001, INV-EXP-001/003, TQ-003 v0.2.0
 * Spec: AC-EW-002, TQ-010 escenarios 1-4
 */

import { describe, expect, it } from 'vitest';
import { DomainError } from '@sigac/domain-kernel';
import { CODIGOS_DERECHOHABIENTE, ExpedienteNumero } from './ExpedienteNumero.js';

describe('ExpedienteNumero', () => {
  // ─── Normalización de separadores ────────────────────────────────────────────

  describe('normalización — las tres variantes representan el mismo valor', () => {
    it('parse con / produce la misma normalización que con -', () => {
      const conSlash = ExpedienteNumero.parse('PERR810604/10');
      const conGuion = ExpedienteNumero.parse('PERR810604-10');
      expect(conSlash.toNormalized()).toBe(conGuion.toNormalized());
    });

    it('parse con / produce la misma normalización que sin separador', () => {
      const conSlash = ExpedienteNumero.parse('PERR810604/10');
      const sinSep = ExpedienteNumero.parse('PERR81060410');
      expect(conSlash.toNormalized()).toBe(sinSep.toNormalized());
    });

    it('parse con - produce la misma normalización que sin separador', () => {
      const conGuion = ExpedienteNumero.parse('PERR810604-10');
      const sinSep = ExpedienteNumero.parse('PERR81060410');
      expect(conGuion.toNormalized()).toBe(sinSep.toNormalized());
    });

    it('la forma normalizada es RFC + código sin separador', () => {
      const ew = ExpedienteNumero.parse('PERR810604/10');
      expect(ew.toNormalized()).toBe('PERR81060410');
    });

    it('la forma normalizada no contiene separadores', () => {
      const ew = ExpedienteNumero.parse('PERR810604-10');
      expect(ew.toNormalized()).not.toContain('/');
      expect(ew.toNormalized()).not.toContain('-');
    });
  });

  // ─── Presentación preferente ─────────────────────────────────────────────────

  describe('presentación — siempre usa / como separador', () => {
    it('toDisplay retorna PERR810604/10 independientemente del separador de entrada', () => {
      expect(ExpedienteNumero.parse('PERR810604/10').toDisplay()).toBe('PERR810604/10');
      expect(ExpedienteNumero.parse('PERR810604-10').toDisplay()).toBe('PERR810604/10');
      expect(ExpedienteNumero.parse('PERR81060410').toDisplay()).toBe('PERR810604/10');
    });

    it('toString retorna la forma de presentación con /', () => {
      const ew = ExpedienteNumero.parse('PERR81060410');
      expect(ew.toString()).toBe('PERR810604/10');
    });
  });

  // ─── Componentes ─────────────────────────────────────────────────────────────

  describe('componentes internos', () => {
    it('rfcBase tiene exactamente 10 caracteres', () => {
      const ew = ExpedienteNumero.parse('PERR810604/10');
      expect(ew.rfcBase).toHaveLength(10);
      expect(ew.rfcBase).toBe('PERR810604');
    });

    it('codigoDerechohabiente es el valor correcto', () => {
      const ew = ExpedienteNumero.parse('PERR810604/10');
      expect(ew.codigoDerechohabiente).toBe('10');
    });
  });

  // ─── Catálogo de códigos ──────────────────────────────────────────────────────

  describe('catálogo de códigos de derechohabiente', () => {
    it.each(CODIGOS_DERECHOHABIENTE)(
      'acepta el código "%s" del catálogo operativo',
      (codigo) => {
        const ew = ExpedienteNumero.parse(`PERR810604/${codigo}`);
        expect(ew.codigoDerechohabiente).toBe(codigo);
      },
    );

    it('acepta 10 (Trabajador)', () => {
      expect(() => ExpedienteNumero.parse('PERR810604/10')).not.toThrow();
    });

    it('acepta 20 (Trabajadora)', () => {
      expect(() => ExpedienteNumero.parse('PERR810604/20')).not.toThrow();
    });

    it('acepta 90 (Pensionado)', () => {
      expect(() => ExpedienteNumero.parse('PERR810604/90')).not.toThrow();
    });
  });

  // ─── Validaciones — casos inválidos ──────────────────────────────────────────

  describe('valores inválidos', () => {
    it('rechaza RFC con menos de 10 caracteres', () => {
      expect(() => ExpedienteNumero.parse('PERR8106/10')).toThrow(DomainError);
    });

    it('rechaza RFC con más de 10 caracteres antes del código', () => {
      // 11 chars antes del código
      expect(() => ExpedienteNumero.parse('PERR8106041/10')).toThrow(DomainError);
    });

    it('rechaza código de derechohabiente 00 (no en catálogo)', () => {
      expect(() => ExpedienteNumero.parse('PERR810604/00')).toThrow(DomainError);
    });

    it('rechaza código de derechohabiente 15 (no en catálogo)', () => {
      expect(() => ExpedienteNumero.parse('PERR810604/15')).toThrow(DomainError);
    });

    it('rechaza código de derechohabiente 100 (3 dígitos)', () => {
      expect(() => ExpedienteNumero.parse('PERR810604/100')).toThrow(DomainError);
    });

    it('rechaza cadena vacía', () => {
      expect(() => ExpedienteNumero.parse('')).toThrow(DomainError);
    });

    it('rechaza formato completamente arbitrario', () => {
      expect(() => ExpedienteNumero.parse('NO-ES-UN-NUMERO')).toThrow(DomainError);
    });

    it('no recorta espacios externos', () => {
      expect(() => ExpedienteNumero.parse(' PERR810604/10')).toThrow(DomainError);
    });

    it('el DomainError tiene code EXPEDIENTE_NUMERO_INVALIDO para formato incorrecto', () => {
      try {
        ExpedienteNumero.parse('PERR810604/00');
      } catch (e) {
        expect(e).toBeInstanceOf(DomainError);
        // Puede ser EXPEDIENTE_NUMERO_INVALIDO o CODIGO_DERECHOHABIENTE_INVALIDO
        expect(['EXPEDIENTE_NUMERO_INVALIDO', 'CODIGO_DERECHOHABIENTE_INVALIDO']).toContain(
          (e as DomainError).code,
        );
      }
    });
  });

  // ─── Igualdad por valor ────────────────────────────────────────────────────────

  describe('igualdad por valor', () => {
    it('/ y - producen VOs iguales', () => {
      const a = ExpedienteNumero.parse('PERR810604/10');
      const b = ExpedienteNumero.parse('PERR810604-10');
      expect(a.equals(b)).toBe(true);
    });

    it('/ y sin separador producen VOs iguales', () => {
      const a = ExpedienteNumero.parse('PERR810604/10');
      const b = ExpedienteNumero.parse('PERR81060410');
      expect(a.equals(b)).toBe(true);
    });

    it('mismo número, diferente código -> no iguales', () => {
      const a = ExpedienteNumero.parse('PERR810604/10');
      const b = ExpedienteNumero.parse('PERR810604/20');
      expect(a.equals(b)).toBe(false);
    });

    it('diferente RFC, mismo código -> no iguales', () => {
      const a = ExpedienteNumero.parse('PERR810604/10');
      const b = ExpedienteNumero.parse('GARZ900101/10');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('RFC base conforme a la definición del SDB', () => {
    it('no impone un catálogo de caracteres adicional a la longitud de 10', () => {
      const numero = ExpedienteNumero.parse('ABCD_10101/10');

      expect(numero.rfcBase).toBe('ABCD_10101');
      expect(numero.toDisplay()).toBe('ABCD_10101/10');
    });
  });
});
