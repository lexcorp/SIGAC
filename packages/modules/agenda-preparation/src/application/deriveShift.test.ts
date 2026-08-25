/**
 * ADR-0031 v1.1 — deriveShift unit tests
 *
 * Pure function: no mocks, no I/O, no side effects.
 * Covers all boundary cases requested by spec + ADR-0031.
 */

import { describe, expect, it } from 'vitest';
import { deriveShift, type AgendaShift } from './deriveShift.js';

describe('deriveShift (ADR-0031 v1.1)', () => {
  // ── MATUTINO region ──────────────────────────────────────────────────────

  it('07:00 → MATUTINO (typical morning start)', () => {
    expect(deriveShift('07:00')).toBe('MATUTINO');
  });

  it('08:20 → MATUTINO (mid-morning)', () => {
    expect(deriveShift('08:20')).toBe('MATUTINO');
  });

  it('12:00 → MATUTINO (noon)', () => {
    expect(deriveShift('12:00')).toBe('MATUTINO');
  });

  it('13:59 → MATUTINO (last minute before vespertino)', () => {
    expect(deriveShift('13:59')).toBe('MATUTINO');
  });

  it('13:40 → MATUTINO (last common morning slot before boundary)', () => {
    expect(deriveShift('13:40')).toBe('MATUTINO');
  });

  // ── boundary ─────────────────────────────────────────────────────────────

  it('14:00 → VESPERTINO (exact boundary)', () => {
    expect(deriveShift('14:00')).toBe('VESPERTINO');
  });

  // ── VESPERTINO region ────────────────────────────────────────────────────

  it('14:20 → VESPERTINO (first afternoon slot)', () => {
    expect(deriveShift('14:20')).toBe('VESPERTINO');
  });

  it('16:00 → VESPERTINO (mid-afternoon)', () => {
    expect(deriveShift('16:00')).toBe('VESPERTINO');
  });

  it('19:40 → VESPERTINO (last typical afternoon slot)', () => {
    expect(deriveShift('19:40')).toBe('VESPERTINO');
  });

  it('23:59 → VESPERTINO (optional: extreme upper bound)', () => {
    expect(deriveShift('23:59')).toBe('VESPERTINO');
  });

  // ── edge: midnight ────────────────────────────────────────────────────────

  it('00:00 → MATUTINO (midnight — treated as start of day)', () => {
    expect(deriveShift('00:00')).toBe('MATUTINO');
  });

  // ── type safety ──────────────────────────────────────────────────────────

  it('return type is AgendaShift (compile-time guard)', () => {
    const result: AgendaShift = deriveShift('08:00');
    expect(['MATUTINO', 'VESPERTINO']).toContain(result);
  });

  it('is a pure function — same input always produces same output', () => {
    const inputs = ['07:00', '13:59', '14:00', '23:59'];
    for (const t of inputs) {
      expect(deriveShift(t)).toBe(deriveShift(t));
    }
  });

  it('produces no side effects (no exception for valid HH:mm)', () => {
    const validTimes = ['07:00', '13:59', '14:00', '19:40', '23:59', '00:00'];
    for (const t of validTimes) {
      expect(() => deriveShift(t)).not.toThrow();
    }
  });
});
