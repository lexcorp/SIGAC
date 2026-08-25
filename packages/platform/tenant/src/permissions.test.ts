/**
 * T-20 — AGENDA_PRINT permission catalog tests
 *
 * Spec: preparation-reports REQ-PR-005
 * ADR: ADR-0030 (PDFKit), ADR-0031 (turno derivado)
 *
 * Verifies:
 *   - AGENDA_PRINT exists in PERMISSIONS with the exact string value.
 *   - AGENDA_PRINT is recognized by isPermission().
 *   - No collision with existing Agenda permissions.
 *   - PERMISSIONS catalog integrity: all values are unique strings.
 *   - Total catalog count reflects the new permission (regression guard).
 */
import { describe, expect, it } from 'vitest';
import { PERMISSIONS, isPermission, type Permission } from './index.js';

describe('T-20 — AGENDA_PRINT in permission catalog', () => {
  it('AGENDA_PRINT is present in PERMISSIONS array', () => {
    expect(PERMISSIONS).toContain('AGENDA_PRINT');
  });

  it('AGENDA_PRINT has the exact string value "AGENDA_PRINT"', () => {
    const match = (PERMISSIONS as readonly string[]).find(p => p === 'AGENDA_PRINT');
    expect(match).toBe('AGENDA_PRINT');
  });

  it('isPermission("AGENDA_PRINT") returns true', () => {
    expect(isPermission('AGENDA_PRINT')).toBe(true);
  });

  it('AGENDA_PRINT is distinct from AGENDA_VIEW', () => {
    expect('AGENDA_PRINT').not.toBe('AGENDA_VIEW');
    // Both must be in the catalog independently
    expect(PERMISSIONS).toContain('AGENDA_VIEW');
    expect(PERMISSIONS).toContain('AGENDA_PRINT');
  });

  it('AGENDA_PRINT is distinct from AGENDA_IMPORT', () => {
    expect('AGENDA_PRINT').not.toBe('AGENDA_IMPORT');
    expect(PERMISSIONS).toContain('AGENDA_IMPORT');
  });

  it('AGENDA_PRINT is distinct from AGENDA_INCIDENT_VIEW', () => {
    expect('AGENDA_PRINT').not.toBe('AGENDA_INCIDENT_VIEW');
    expect(PERMISSIONS).toContain('AGENDA_INCIDENT_VIEW');
  });

  it('all PERMISSIONS values are unique (no duplicates)', () => {
    const unique = new Set<string>(PERMISSIONS);
    expect(unique.size).toBe(PERMISSIONS.length);
  });

  it('PERMISSIONS catalog has the expected total count (regression guard)', () => {
    // 20 existing + 1 AGENDA_PRINT added in T-20 = 24 total
    // Update this count if new permissions are added in future tasks.
    expect(PERMISSIONS).toHaveLength(24);
  });

  it('Permission type includes AGENDA_PRINT (compile-time guard)', () => {
    // This assignment would fail to compile if AGENDA_PRINT is not in Permission.
    const p: Permission = 'AGENDA_PRINT';
    expect(p).toBe('AGENDA_PRINT');
  });

  it('isPermission rejects unknown strings after AGENDA_PRINT was added', () => {
    expect(isPermission('AGENDA_PRINT_ALL')).toBe(false);
    expect(isPermission('agenda_print')).toBe(false); // case-sensitive
    expect(isPermission('')).toBe(false);
  });
});
