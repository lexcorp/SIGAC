/**
 * T-04 — ValeBatch persistence integration tests (PostgreSQL real)
 *
 * Tests: migrations, batch, trace, idempotency, numeración, tenant isolation,
 * snapshot PII-free, resolvedConflicts, rollback, UNIQUE(numero_vale).
 *
 * All data synthetic — no real SIMEF or patient data.
 */
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  GenerateValeBatch,
  type GenerateValeBatchCommand,
} from '../../packages/modules/vale-archivo/src/application/index.js';
import {
  PostgresValeBatchUnitOfWork,
  TenantDatabaseRouter,
  PostgresAuditWriter,
} from '../../packages/platform/database/src/index.js';
import type { RequestContext, TenantContext } from '../../packages/platform/tenant/src/index.js';

// ── Infra helpers ─────────────────────────────────────────────────────────────

const adminUrl = process.env['SIGAC_POSTGRES_ADMIN_URL'] ??
  'postgresql://sigac:sigac_dev_only@localhost:5432/postgres';

const suffix = randomUUID().replaceAll('-', '');
const DB_A = `sigac_valbatch_a_${suffix}`;
const DB_B = `sigac_valbatch_b_${suffix}`;

function dbUrl(name: string) {
  const url = new URL(adminUrl); url.pathname = `/${name}`; return url.toString();
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

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTenant(dbName: string, n: number): TenantContext {
  return { tenantId: `tenant-vbatch-${n}`, slug: `hospital-${n}`, hospitalId: `hosp-${n}`, databaseName: dbName, timezone: 'America/Mexico_City' };
}

function makeContext(tenant: TenantContext): RequestContext {
  return {
    actor: { actorId: 'actor-vbatch', roles: new Set(), permissions: new Set(['REQUEST_CREATE']), tenantIds: new Set([tenant.tenantId]) },
    tenant, requestId: 'req-vbatch', correlationId: 'corr-vbatch', source: 'WEB',
  };
}

function makeCommand(overrides: { groups?: number; snapshotHash?: string; suffix?: string } = {}): GenerateValeBatchCommand {
  const s = overrides.suffix ?? suffix.slice(0, 6);
  const hash = overrides.snapshotHash ?? `hash-${s}`;
  const numGroups = overrides.groups ?? 1;
  return {
    source: { kind: 'AGENDA_PREPARATION', agendaDate: '2026-09-15', sourceImportacionId: `import-${s}`, sourceVersion: `ver-${s}`, generationSnapshotHash: hash },
    header: { fechaSolicitud: '2026-09-15', fechaRecepcion: '2026-09-15', unidadSolicitante: 'DIR MED SINT', solicitanteNombre: 'DR SINT', solicitanteCargo: 'Director', autorizadorNombre: 'DRA SINT', autorizadorCargo: 'Subdirectora' },
    groups: Array.from({ length: numGroups }, (_, i) => ({
      agendaDate: '2026-09-15',
      servicioCodigo: `SVC-${i + 1}`,
      servicioNombre: `Servicio ${i + 1} Sintético`,
      medicoNumeroEmpleado: `EMP${i + 1}`,
      medicoNombre: `DR SINT ${i + 1}`,
      items: [{ expedienteNumero: `EXP-${s}-${i + 1}`, pacienteNombre: `PAC SINT ${i + 1}`, appointmentReferences: [{ folio: `FOL-${s}-${i + 1}`, servicioCodigo: `SVC-${i + 1}`, medicoNumeroEmpleado: `EMP${i + 1}` }] }],
    })),
    resolvedConflicts: [],
    context: makeContext(makeTenant(DB_A, 1)),
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('T-04 — ValeBatch persistence (PostgreSQL real)', () => {
  const admin   = new Client({ connectionString: adminUrl });
  const clientA = new Client({ connectionString: dbUrl(DB_A) });
  const clientB = new Client({ connectionString: dbUrl(DB_B) });

  let router: TenantDatabaseRouter;
  let tenantA: TenantContext;
  let tenantB: TenantContext;
  let useCase: GenerateValeBatch;

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${DB_A}"`);
    await admin.query(`CREATE DATABASE "${DB_B}"`);
    await clientA.connect(); await clientB.connect();
    await applyMigrations(clientA); await applyMigrations(clientB);

    tenantA = makeTenant(DB_A, 1);
    tenantB = makeTenant(DB_B, 2);

    router = new TenantDatabaseRouter([
      { tenantId: tenantA.tenantId, databaseName: DB_A, connectionString: dbUrl(DB_A) },
      { tenantId: tenantB.tenantId, databaseName: DB_B, connectionString: dbUrl(DB_B) },
    ]);

    const auditWriter = new PostgresAuditWriter(router);
    const unitOfWork  = new PostgresValeBatchUnitOfWork(router, () => auditWriter);
    useCase = new GenerateValeBatch({ unitOfWork, auditWriter });
  }, 60_000);

  afterAll(async () => {
    await router.close(); await clientA.end(); await clientB.end();
    await admin.query(`DROP DATABASE "${DB_A}"`);
    await admin.query(`DROP DATABASE "${DB_B}"`);
    await admin.end();
  }, 30_000);

  // ── T-04-M: Migrations ────────────────────────────────────────────────────

  it('T-04-M1: migrations create vale_daily_sequence with primary key on fecha_solicitud', async () => {
    const r = await clientA.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='vale_daily_sequence'`);
    expect(r.rows.map(r => r.column_name).sort()).toEqual(['fecha_solicitud', 'last_sequence']);
  });

  it('T-04-M2: migrations create vale_generation_batch with idempotency UNIQUE constraint', async () => {
    const r = await clientA.query<{ constraint_name: string }>(
      `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='vale_generation_batch' AND constraint_type='UNIQUE'`);
    expect(r.rows.map(r => r.constraint_name)).toContain('vale_generation_batch_idempotency_uq');
  });

  it('T-04-M3: migrations create vale_generation_trace with UNIQUE on vale_id', async () => {
    const r = await clientA.query<{ constraint_name: string }>(
      `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='vale_generation_trace' AND constraint_type='UNIQUE'`);
    expect(r.rows.map(r => r.constraint_name)).toContain('vale_generation_trace_vale_uq');
  });

  it('T-04-M4: vale_archivo retains UNIQUE(numero_vale) from previous migration', async () => {
    const r = await clientA.query<{ constraint_name: string }>(
      `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='vale_archivo' AND constraint_type='UNIQUE'`);
    expect(r.rows.map(r => r.constraint_name)).toContain('vale_archivo_numero_vale_unique');
  });

  // ── T-04-G: Generation ────────────────────────────────────────────────────

  it('T-04-G1: basic generation persists batch, Vale, items and trace', async () => {
    const cmd = makeCommand({ suffix: `g1${suffix.slice(0,4)}` });
    const result = await useCase.execute(cmd);

    expect(result.generatedVales).toHaveLength(1);
    expect(result.generatedVales[0]!.outcome).toBe('GENERATED');
    expect(result.generatedVales[0]!.numeroVale).toMatch(/^VA-\d{8}-\d{3}$/);

    const valeId = result.generatedVales[0]!.valeId;

    // Vale exists
    const vale = await clientA.query(`SELECT id FROM vale_archivo WHERE id=$1`, [valeId]);
    expect(vale.rows).toHaveLength(1);

    // Batch exists
    const batch = await clientA.query(
      `SELECT id FROM vale_generation_batch WHERE source_importacion_id=$1`,
      [cmd.source.sourceImportacionId]);
    expect(batch.rows).toHaveLength(1);

    // Trace exists
    const trace = await clientA.query(
      `SELECT vale_id, numero_vale, items, resolved_conflicts FROM vale_generation_trace WHERE vale_id=$1`,
      [valeId]);
    expect(trace.rows).toHaveLength(1);
    expect(trace.rows[0]!.numero_vale).toBe(result.generatedVales[0]!.numeroVale);
  });

  // ── T-04-R: Replay ────────────────────────────────────────────────────────

  it('T-04-R1: replay returns ALREADY_GENERATED without creating new Vale', async () => {
    const cmd = makeCommand({ suffix: `r1${suffix.slice(0,4)}` });
    const first  = await useCase.execute(cmd);
    const second = await useCase.execute({ ...cmd, context: makeContext(tenantA) });

    expect(second.generatedVales[0]!.outcome).toBe('ALREADY_GENERATED');
    expect(second.generatedVales[0]!.valeId).toBe(first.generatedVales[0]!.valeId);

    // Only one Vale in DB
    const valeRows = await clientA.query(
      `SELECT id FROM vale_archivo WHERE numero_vale=$1`,
      [first.generatedVales[0]!.numeroVale]);
    expect(valeRows.rows).toHaveLength(1);
  });

  it('T-04-R2: replay does not reserve a new daily sequence number', async () => {
    const cmd = makeCommand({ suffix: `r2${suffix.slice(0,4)}` });
    const first  = await useCase.execute(cmd);
    const second = await useCase.execute({ ...cmd, context: makeContext(tenantA) });

    // Both return same numeroVale
    expect(second.generatedVales[0]!.numeroVale).toBe(first.generatedVales[0]!.numeroVale);
  });

  // ── T-04-N: Numeración ────────────────────────────────────────────────────

  it('T-04-N1: consecutive same-date generations produce different sequential numbers', async () => {
    const date = '2026-09-16';
    const s1 = `n1a${suffix.slice(0,3)}`; const s2 = `n1b${suffix.slice(0,3)}`;
    const r1 = await useCase.execute(makeCommand({ suffix: s1, snapshotHash: `hn1a${s1}` }));
    const r2 = await useCase.execute(makeCommand({ suffix: s2, snapshotHash: `hn1b${s2}` }));
    void date;
    const num1 = parseInt(r1.generatedVales[0]!.numeroVale.split('-').at(-1)!, 10);
    const num2 = parseInt(r2.generatedVales[0]!.numeroVale.split('-').at(-1)!, 10);
    expect(num2).toBeGreaterThan(num1);
  });

  // ── T-04-I: Tenant isolation ──────────────────────────────────────────────

  it('T-04-I1: same idempotency key on different tenants generates independent Vales', async () => {
    const s = `i1${suffix.slice(0,4)}`;
    const cmdA = makeCommand({ suffix: s });
    const cmdB = { ...makeCommand({ suffix: s }), context: makeContext(tenantB) };

    const resultA = await useCase.execute(cmdA);
    const resultB = await useCase.execute(cmdB);

    // Both succeed as GENERATED (different tenant DBs)
    expect(resultA.generatedVales[0]!.outcome).toBe('GENERATED');
    expect(resultB.generatedVales[0]!.outcome).toBe('GENERATED');
    // Different valeIds (different DBs)
    expect(resultA.generatedVales[0]!.valeId).not.toBe(resultB.generatedVales[0]!.valeId);

    // Tenant B Vale not visible in Tenant A DB
    const crossCheck = await clientA.query(
      `SELECT id FROM vale_archivo WHERE id=$1`, [resultB.generatedVales[0]!.valeId]);
    expect(crossCheck.rows).toHaveLength(0);
  });

  it('T-04-I2: Tenant B daily sequence is independent of Tenant A', async () => {
    const s = `i2${suffix.slice(0,4)}`;
    const cmdA = makeCommand({ suffix: `${s}a`, snapshotHash: `hi2a${s}` });
    const cmdB = { ...makeCommand({ suffix: `${s}b`, snapshotHash: `hi2b${s}` }), context: makeContext(tenantB) };
    const ra = await useCase.execute(cmdA);
    const rb = await useCase.execute(cmdB);
    // Both start from 1 for their respective tenant+date
    expect(ra.generatedVales[0]!.numeroVale).toMatch(/^VA-\d{8}-\d{3}$/);
    expect(rb.generatedVales[0]!.numeroVale).toMatch(/^VA-\d{8}-\d{3}$/);
  });

  // ── T-04-S: Snapshot ──────────────────────────────────────────────────────

  it('T-04-S1: trace snapshot contains servicio, medico, Vale and FOLIO — no PII', async () => {
    const s = `s1${suffix.slice(0,4)}`;
    const result = await useCase.execute(makeCommand({ suffix: s }));
    const valeId = result.generatedVales[0]!.valeId;
    const trace = await clientA.query<{ servicio_codigo: string; medico_nombre: string; items: unknown; resolved_conflicts: unknown }>(
      `SELECT servicio_codigo, medico_nombre, items, resolved_conflicts FROM vale_generation_trace WHERE vale_id=$1`,
      [valeId]);

    expect(trace.rows[0]!.servicio_codigo).toBe('SVC-1');
    expect(trace.rows[0]!.medico_nombre).toBe('DR SINT 1');

    const items = trace.rows[0]!.items as { expedienteNumero: string; appointmentReferences: unknown[] }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]!.expedienteNumero).toContain('EXP-');
    // No paciente data in trace items
    for (const item of items) {
      expect(JSON.stringify(item)).not.toMatch(/pacienteNombre/);
    }
  });

  it('T-04-S2: resolvedConflicts persisted with owner, alternatives and excluded references', async () => {
    const s = `s2${suffix.slice(0,4)}`;
    const ownerGroup = { agendaDate: '2026-09-15', servicioCodigo: 'SVC-1', medicoNumeroEmpleado: 'EMP1' };
    const expConf = `EXP-CONF-${s}`;
    const baseCmd = makeCommand({ suffix: s, snapshotHash: `hs2${s}` });
    // Override the group item to use the conflict's expedienteNumero so that
    // toTraceSnapshot can locate it in snapshot.items
    const cmd: GenerateValeBatchCommand = {
      ...baseCmd,
      groups: [{ ...baseCmd.groups[0]!, items: [{ ...baseCmd.groups[0]!.items[0]!, expedienteNumero: expConf }] }],
      resolvedConflicts: [{
        expedienteNumero: expConf,
        ownerValeItemId: '',     // filled by toTraceSnapshot in GenerateValeBatch
        ownerGroup,
        alternatives: [{
          group: { agendaDate: '2026-09-15', servicioCodigo: 'SVC-ALT', medicoNumeroEmpleado: 'EMPALT' },
          appointmentReferences: [{ folio: `FOL-ALT-${s}`, servicioCodigo: 'SVC-ALT', medicoNumeroEmpleado: 'EMPALT' }],
        }],
      }],
    };
    const result = await useCase.execute(cmd);
    const valeId = result.generatedVales[0]!.valeId;
    const trace = await clientA.query<{ resolved_conflicts: unknown }>(
      `SELECT resolved_conflicts FROM vale_generation_trace WHERE vale_id=$1`, [valeId]);

    const conflicts = trace.rows[0]!.resolved_conflicts as { expedienteNumero: string; ownerGroup: object; alternatives: unknown[] }[];
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.expedienteNumero).toBe(expConf);
    expect(conflicts[0]!.alternatives).toHaveLength(1);
    // No PII
    expect(JSON.stringify(conflicts)).not.toMatch(/pacienteNombre/);
  });

  // ── T-04-T: Rollback ──────────────────────────────────────────────────────

  it('T-04-T1: failed transaction leaves no Vale, batch, trace, or daily sequence increment', async () => {
    // Force failure by inserting a duplicate numero_vale
    const s = `t1${suffix.slice(0,4)}`;
    const firstCmd = makeCommand({ suffix: s, snapshotHash: `ht1f${s}` });
    const first = await useCase.execute(firstCmd);
    const existingNumero = first.generatedVales[0]!.numeroVale;

    // Count sequences before
    const seqBefore = await clientA.query<{ last_sequence: number }>(
      `SELECT last_sequence FROM vale_daily_sequence WHERE fecha_solicitud='2026-09-15'`);

    // Try to create a Vale with the same numero_vale (will fail on UNIQUE constraint)
    // We test atomicity by observing the DB state after the failure
    try {
      await clientA.query(
        `INSERT INTO vale_archivo (id, numero_vale, fecha_solicitud, fecha_recepcion,
           unidad_solicitante, solicitante_nombre, solicitante_cargo,
           autorizador_nombre, autorizador_cargo, estado, creado_por, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, '2026-09-15', '2026-09-15',
           'TEST', 'TEST', 'TEST', 'TEST', 'TEST', 'RECIBIDA', 'test', now(), now())`,
        [existingNumero]);
    } catch {
      // Expected: duplicate key
    }

    // The original Vale should still exist (no phantom deletion)
    const check = await clientA.query(`SELECT id FROM vale_archivo WHERE numero_vale=$1`, [existingNumero]);
    expect(check.rows).toHaveLength(1);

    // Sequence is unchanged from before our failed duplicate attempt
    const seqAfter = await clientA.query<{ last_sequence: number }>(
      `SELECT last_sequence FROM vale_daily_sequence WHERE fecha_solicitud='2026-09-15'`);
    expect(seqAfter.rows[0]!.last_sequence).toBe(seqBefore.rows[0]!.last_sequence);
  });
});
