/**
 * BUG-REIMPORT DB layer regression tests
 *
 * Verifies that findEquivalent() only considers a fingerprint "equivalent"
 * (blocking reimportation) when the associated import had rejected=0 AND
 * pending_review=0.
 *
 * This covers both:
 *   - New imports (fingerprints never registered for incomplete ones).
 *   - Historical bad fingerprints registered before the BUG-REIMPORT fix.
 *
 * All fixtures are synthetic — no real SIMEF data.
 */

import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AgendaFecha,
  ImportacionAgendaId,
} from '../../packages/modules/agenda-preparation/src/index.js';
import {
  PostgresImportArtifactMetadataRepository,
  TenantDatabaseRouter,
} from '../../packages/platform/database/src/index.js';
import type { TenantContext } from '../../packages/platform/tenant/src/index.js';

// ── Infrastructure ─────────────────────────────────────────────────────────

const adminUrl =
  process.env.SIGAC_POSTGRES_ADMIN_URL ??
  'postgresql://sigac:sigac_dev_only@localhost:5432/postgres';

const suffix  = randomUUID().replaceAll('-', '');
const DB_NAME = `sigac_reimport_test_${suffix}`;

function dbUrl(name: string) {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function applyMigrations(client: Client) {
  const dir = new URL('../../migrations/tenant/', import.meta.url);
  const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, dir), 'utf8');
    for (const stmt of sql.split('--> statement-breakpoint'))
      if (stmt.trim()) await client.query(stmt);
  }
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('BUG-REIMPORT — findEquivalent() DB layer regressions', () => {
  const admin  = new Client({ connectionString: adminUrl });
  const client = new Client({ connectionString: dbUrl(DB_NAME) });

  const tenant: TenantContext = {
    tenantId: 'tenant-reimport', slug: 'test', hospitalId: 'hosp',
    databaseName: DB_NAME, timezone: 'America/Mexico_City',
  };

  let router: TenantDatabaseRouter;
  let repo:   PostgresImportArtifactMetadataRepository;

  // Unique fingerprints per test to avoid cross-test pollution
  const FP_ALL_REJECTED  = `fp-all-rej-${suffix.slice(0, 8)}`;
  const FP_ALL_PENDING   = `fp-all-pend-${suffix.slice(0, 8)}`;
  const FP_ALL_SUCCESS   = `fp-all-ok-${suffix.slice(0, 8)}`;
  const FP_PARTIAL       = `fp-partial-${suffix.slice(0, 8)}`;
  const SYNTHETIC_DATE   = '2026-09-10';

  // Insert a row into agenda_imports + agenda_artifact_metadata directly
  async function seedImport(opts: {
    fingerprint: string;
    agendaDate: string;
    rejected: number;
    pendingReview: number;
    added: number;
  }): Promise<string> {
    const importId = randomUUID();
    const total = opts.added + opts.rejected + opts.pendingReview;
    await client.query(
      `INSERT INTO agenda_imports (id, agenda_date, imported_at, outcome,
         received_records, processed, added, updated, unchanged, restored,
         pending_review, rejected, duplicate_folio, withdrawn_from_agenda,
         incidents, errors)
       VALUES ($1, $2, now(), 'IMPORTED', $3, $4, $5, 0, 0, 0, $6, $7, 0, 0, 0, 0)`,
      [importId, opts.agendaDate, total, opts.added, opts.added, opts.pendingReview, opts.rejected],
    );
    await client.query(
      `INSERT INTO agenda_artifact_metadata (id, importacion_id, agenda_date, fingerprint, imported_at)
       VALUES ($1, $2, $3, $4, now())`,
      [randomUUID(), importId, opts.agendaDate, opts.fingerprint],
    );
    return importId;
  }

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${DB_NAME}"`);
    await client.connect();
    await applyMigrations(client);

    router = new TenantDatabaseRouter([{
      tenantId:         tenant.tenantId,
      databaseName:     DB_NAME,
      connectionString: dbUrl(DB_NAME),
    }]);
    repo = new PostgresImportArtifactMetadataRepository(router);

    // Seed all test scenarios
    await seedImport({ fingerprint: FP_ALL_REJECTED, agendaDate: SYNTHETIC_DATE, rejected: 411, pendingReview: 0, added: 0 });
    await seedImport({ fingerprint: FP_ALL_PENDING,  agendaDate: SYNTHETIC_DATE, rejected: 0, pendingReview: 50, added: 0 });
    await seedImport({ fingerprint: FP_ALL_SUCCESS,  agendaDate: SYNTHETIC_DATE, rejected: 0, pendingReview: 0,  added: 200 });
    await seedImport({ fingerprint: FP_PARTIAL,      agendaDate: SYNTHETIC_DATE, rejected: 30, pendingReview: 0, added: 170 });
  }, 30_000);

  afterAll(async () => {
    await router.close();
    await client.end();
    await admin.query(`DROP DATABASE "${DB_NAME}"`);
    await admin.end();
  }, 15_000);

  // ── Regression 1: historical bad fingerprint (all rejected) ───────────────

  it('R1: fingerprint with prior rejected=411, added=0 → findEquivalent returns null (NOT ALREADY_IMPORTED)', async () => {
    const result = await repo.findEquivalent(
      { agendaDate: AgendaFecha.parse(SYNTHETIC_DATE), fingerprint: { value: FP_ALL_REJECTED } },
      tenant,
    );
    // Must return null — this fingerprint points to a 100%-rejected import
    expect(result).toBeNull();
  });

  // ── Regression 2: prior pendingReview > 0 ────────────────────────────────

  it('R2: fingerprint with prior pendingReview=50 → findEquivalent returns null', async () => {
    const result = await repo.findEquivalent(
      { agendaDate: AgendaFecha.parse(SYNTHETIC_DATE), fingerprint: { value: FP_ALL_PENDING } },
      tenant,
    );
    expect(result).toBeNull();
  });

  // ── Regression 3: fully successful import is equivalent ───────────────────

  it('R3: fully successful fingerprint (added=200, rejected=0) → findEquivalent returns importacionId', async () => {
    const result = await repo.findEquivalent(
      { agendaDate: AgendaFecha.parse(SYNTHETIC_DATE), fingerprint: { value: FP_ALL_SUCCESS } },
      tenant,
    );
    expect(result).not.toBeNull();
    expect(result!.importacionId).toBeInstanceOf(ImportacionAgendaId);
  });

  // ── Regression 4: partial (some rejected) is not equivalent ───────────────

  it('R4: partial import (added=170, rejected=30) → findEquivalent returns null → reprocesable', async () => {
    const result = await repo.findEquivalent(
      { agendaDate: AgendaFecha.parse(SYNTHETIC_DATE), fingerprint: { value: FP_PARTIAL } },
      tenant,
    );
    expect(result).toBeNull();
  });

  // ── Regression 5: after successful reimport, fingerprint becomes blocking ──

  it('R5: successful reimport registers fingerprint → subsequent findEquivalent returns importacionId', async () => {
    const FP_NOW_COMPLETE = `fp-now-complete-${suffix.slice(0, 8)}`;

    // Simulate the "fixed" reimport result: all valid, none rejected
    const importId = await seedImport({
      fingerprint: FP_NOW_COMPLETE, agendaDate: SYNTHETIC_DATE,
      rejected: 0, pendingReview: 0, added: 411,
    });

    const result = await repo.findEquivalent(
      { agendaDate: AgendaFecha.parse(SYNTHETIC_DATE), fingerprint: { value: FP_NOW_COMPLETE } },
      tenant,
    );
    expect(result).not.toBeNull();
    expect(result!.importacionId.value).toBe(importId);
  });

  // ── Regression 6: all historical records preserved (trazabilidad) ─────────

  it('R6: all historical import records remain in agenda_artifact_metadata (full audit trail)', async () => {
    const rows = await client.query<{ fingerprint: string }>(
      `SELECT fingerprint FROM agenda_artifact_metadata WHERE agenda_date = $1`,
      [SYNTHETIC_DATE],
    );
    const fps = rows.rows.map(r => r.fingerprint);
    expect(fps).toContain(FP_ALL_REJECTED);   // still there — data NOT deleted
    expect(fps).toContain(FP_ALL_PENDING);
    expect(fps).toContain(FP_ALL_SUCCESS);
    expect(fps).toContain(FP_PARTIAL);
    // findEquivalent ignores the bad ones at query time, not by deleting them
  });
});
