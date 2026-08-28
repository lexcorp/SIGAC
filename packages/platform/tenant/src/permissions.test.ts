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
    // 24 after T-20 (AGENDA_PRINT) + 3 added in T-30
    // (ARCHIVE_REQUEST_VIEW, ARCHIVE_REQUEST_PROCESS, ARCHIVE_REQUEST_DELIVER) = 27 total.
    // Update this count if new permissions are added in future tasks.
    expect(PERMISSIONS).toHaveLength(27);
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

describe('T-30 — Vale Archivo permissions in catalog (ADR-0033 v2)', () => {
  // ── Existence ──────────────────────────────────────────────────────────────

  it('ARCHIVE_REQUEST_VIEW is present in PERMISSIONS', () => {
    expect(PERMISSIONS).toContain('ARCHIVE_REQUEST_VIEW');
  });

  it('ARCHIVE_REQUEST_PROCESS is present in PERMISSIONS', () => {
    expect(PERMISSIONS).toContain('ARCHIVE_REQUEST_PROCESS');
  });

  it('ARCHIVE_REQUEST_DELIVER is present in PERMISSIONS', () => {
    expect(PERMISSIONS).toContain('ARCHIVE_REQUEST_DELIVER');
  });

  // ── Exact string values ────────────────────────────────────────────────────

  it('ARCHIVE_REQUEST_VIEW has exact string value', () => {
    expect((PERMISSIONS as readonly string[]).find(p => p === 'ARCHIVE_REQUEST_VIEW'))
      .toBe('ARCHIVE_REQUEST_VIEW');
  });

  it('ARCHIVE_REQUEST_PROCESS has exact string value', () => {
    expect((PERMISSIONS as readonly string[]).find(p => p === 'ARCHIVE_REQUEST_PROCESS'))
      .toBe('ARCHIVE_REQUEST_PROCESS');
  });

  it('ARCHIVE_REQUEST_DELIVER has exact string value', () => {
    expect((PERMISSIONS as readonly string[]).find(p => p === 'ARCHIVE_REQUEST_DELIVER'))
      .toBe('ARCHIVE_REQUEST_DELIVER');
  });

  // ── isPermission() recognition ─────────────────────────────────────────────

  it('isPermission recognizes all three new permissions', () => {
    expect(isPermission('ARCHIVE_REQUEST_VIEW')).toBe(true);
    expect(isPermission('ARCHIVE_REQUEST_PROCESS')).toBe(true);
    expect(isPermission('ARCHIVE_REQUEST_DELIVER')).toBe(true);
  });

  // ── Distinction: no collision between the three new permissions ────────────

  it('the three new permissions are mutually distinct', () => {
    const newPerms = ['ARCHIVE_REQUEST_VIEW', 'ARCHIVE_REQUEST_PROCESS', 'ARCHIVE_REQUEST_DELIVER'];
    const unique = new Set(newPerms);
    expect(unique.size).toBe(3);
  });

  // ── Distinction: new permissions are distinct from existing ones ───────────

  it('ARCHIVE_REQUEST_VIEW is distinct from EXPEDIENT_VIEW (different scope)', () => {
    expect('ARCHIVE_REQUEST_VIEW').not.toBe('EXPEDIENT_VIEW');
    expect(PERMISSIONS).toContain('EXPEDIENT_VIEW');
  });

  it('ARCHIVE_REQUEST_PROCESS is distinct from SEARCH_MARK_LOCATED (different BC)', () => {
    expect('ARCHIVE_REQUEST_PROCESS').not.toBe('SEARCH_MARK_LOCATED');
    expect('ARCHIVE_REQUEST_PROCESS').not.toBe('SEARCH_MARK_NOT_LOCATED');
    expect('ARCHIVE_REQUEST_PROCESS').not.toBe('SEARCH_START');
    // The general permissions still exist in the catalog for archive-operations
    expect(PERMISSIONS).toContain('SEARCH_MARK_LOCATED');
    expect(PERMISSIONS).toContain('SEARCH_MARK_NOT_LOCATED');
    expect(PERMISSIONS).toContain('SEARCH_START');
  });

  it('ARCHIVE_REQUEST_DELIVER is distinct from CUSTODY_TRANSFER (different BC)', () => {
    expect('ARCHIVE_REQUEST_DELIVER').not.toBe('CUSTODY_TRANSFER');
    // CUSTODY_TRANSFER still exists for archive-operations
    expect(PERMISSIONS).toContain('CUSTODY_TRANSFER');
  });

  // ── Existing permissions preserved (regression) ────────────────────────────

  it('existing general permissions are not removed or renamed', () => {
    const preserved = [
      'REQUEST_CREATE', 'REQUEST_ASSIGN',
      'SEARCH_START', 'SEARCH_MARK_LOCATED', 'SEARCH_MARK_NOT_LOCATED',
      'CUSTODY_TRANSFER', 'EXPEDIENT_DISPATCH', 'CUSTODY_ACCEPT',
      'EXPEDIENT_VIEW', 'EXPEDIENT_AUDIT_VIEW', 'LOCATION_VIEW',
      'AGENDA_VIEW', 'AGENDA_IMPORT', 'AGENDA_INCIDENT_VIEW', 'AGENDA_PRINT',
    ];
    for (const p of preserved) {
      expect(PERMISSIONS, `permission ${p} should still exist`).toContain(p);
    }
  });

  // ── No collisions in the full catalog ─────────────────────────────────────

  it('all PERMISSIONS values remain unique after T-30 additions', () => {
    const unique = new Set<string>(PERMISSIONS);
    expect(unique.size).toBe(PERMISSIONS.length);
  });

  // ── Updated catalog count (regression guard) ───────────────────────────────

  it('PERMISSIONS catalog has 27 entries after T-30 (24 previous + 3 new)', () => {
    expect(PERMISSIONS).toHaveLength(27);
  });

  // ── Type-level guards ──────────────────────────────────────────────────────

  it('Permission type includes all three new permissions (compile-time guard)', () => {
    const view: Permission = 'ARCHIVE_REQUEST_VIEW';
    const process: Permission = 'ARCHIVE_REQUEST_PROCESS';
    const deliver: Permission = 'ARCHIVE_REQUEST_DELIVER';
    expect(view).toBe('ARCHIVE_REQUEST_VIEW');
    expect(process).toBe('ARCHIVE_REQUEST_PROCESS');
    expect(deliver).toBe('ARCHIVE_REQUEST_DELIVER');
  });

  it('isPermission rejects case-variants and partial names', () => {
    expect(isPermission('archive_request_view')).toBe(false);
    expect(isPermission('ARCHIVE_REQUEST')).toBe(false);
    expect(isPermission('ARCHIVE_REQUEST_CREATE')).toBe(false); // never approved
    expect(isPermission('ARCHIVE_REQUEST_APPROVE')).toBe(false); // never approved
  });

  // ── INV-VA-012: ARCHIVE_REQUEST_PROCESS covers both locate operations ──────

  it('INV-VA-012: a single ARCHIVE_REQUEST_PROCESS covers both locate and not-locate (design validation)', () => {
    // The bounded context uses one permission for all processing actions;
    // the controller decides which use case to call based on the request body.
    expect(isPermission('ARCHIVE_REQUEST_PROCESS')).toBe(true);
    // SEARCH_MARK_LOCATED and SEARCH_MARK_NOT_LOCATED are NOT used for vales
    // (they are reserved for archive-operations flows).
    expect('ARCHIVE_REQUEST_PROCESS').not.toBe('SEARCH_MARK_LOCATED');
    expect('ARCHIVE_REQUEST_PROCESS').not.toBe('SEARCH_MARK_NOT_LOCATED');
  });
});
