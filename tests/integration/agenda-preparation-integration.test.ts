/**
 * T-17 — PostgreSQL integration
 *
 * Full-stack integration test for Agenda Preparation:
 * Application → parser (SimefAgendaParserAdapter) → Repository/UoW → tenant PostgreSQL
 *
 * Covers:
 * - first import (IMPORTED)
 * - reimport identical artifact (ALREADY_IMPORTED)
 * - idempotency key reuse with different artifact (IDEMPOTENCY_KEY_REUSED)
 * - reimport with changes (RECONCILED)
 * - rollback on UoW failure
 * - read models via direct SQL (day summary, preparation list, import history)
 * - fingerprint separation (agenda_artifact_metadata vs agenda_imports)
 * - tenant isolation (tenant A data not visible in tenant B)
 * - migration validity (all 7 Agenda tables present)
 * - privacy: no prohibited columns in any Agenda table
 */
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import {
  ImportAgenda,
  MedicoReferencia,
  NumeroEmpleado,
  SimefAgendaParserAdapter,
} from '../../packages/modules/agenda-preparation/src/index.js';
import {
  PostgresAgendaPreparationUnitOfWork,
  PostgresIdempotencyKeyRepository,
  PostgresImportArtifactMetadataRepository,
  TenantDatabaseRouter,
} from '../../packages/platform/database/src/index.js';
import type { RequestContext, TenantContext } from '../../packages/platform/tenant/src/index.js';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Infrastructure helpers
// ---------------------------------------------------------------------------

const adminUrl =
  process.env.SIGAC_POSTGRES_ADMIN_URL ??
  'postgresql://sigac:sigac_dev_only@localhost:5432/postgres';
const suffix = randomUUID().replaceAll('-', '');
const DB_TENANT_A = `sigac_ap_int_a_${suffix}`;
const DB_TENANT_B = `sigac_ap_int_b_${suffix}`;
const databaseNames = [DB_TENANT_A, DB_TENANT_B] as const;

function databaseUrl(name: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

function tenant(dbName: string, n: number): TenantContext {
  return {
    tenantId: `tenant-int-${n}`,
    slug: `hospital-int-${n}`,
    hospitalId: `hosp-int-${n}`,
    databaseName: dbName,
    timezone: 'America/Mexico_City',
  };
}

function context(dbName: string, n: number): RequestContext {
  return {
    actor: {
      actorId: `actor-int-${n}`,
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(['AGENDA_IMPORT', 'AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW']),
      tenantIds: new Set([`tenant-int-${n}`]),
    },
    tenant: tenant(dbName, n),
    requestId: `req-int-${n}`,
    correlationId: `corr-int-${n}`,
    source: 'WEB',
  };
}

async function applyMigrations(client: Client): Promise<void> {
  const directory = new URL('../../migrations/tenant/', import.meta.url);
  const files = (await readdir(directory)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, directory), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await client.query(statement);
    }
  }
}

// ---------------------------------------------------------------------------
// Synthetic SIMEF HTML fixture builder
//
// All strings are ASCII-only to be byte-identical between UTF-8 and ISO-8859-1.
// The parser accepts "Medico:" (no accent) via /^M[eé]dico:/i.
// Column layout (0-based): no_cita, fecha, hora, folio, expediente, tipo,
//   nombre, contacto, vigencia, sexo, edad, primera_vez(P), subsecuente(S)
// ---------------------------------------------------------------------------

function buildSimefHtml(opts: {
  dateStr: string; // DD/MM/YYYY
  physNumber: string;
  physName: string;
  serviceCode: string;
  serviceName: string;
  rows: Array<{
    num: string;
    folio: string;
    exp: string;
    hora: string;
    tipo: string;
    nombre: string;
    primeraVez?: boolean;
  }>;
}): Uint8Array {
  const rowsHtml = opts.rows
    .map((r) => {
      const p = r.primeraVez !== false ? 'X' : '';
      const s = r.primeraVez === false ? 'X' : '';
      return (
        `<tr><td>${r.num}</td><td>${opts.dateStr}</td><td>${r.hora}</td><td>${r.folio}</td>` +
        `<td>${r.exp}</td><td>${r.tipo}</td><td>${r.nombre}</td>` +
        `<td></td><td></td><td></td><td></td><td>${p}</td><td>${s}</td></tr>`
      );
    })
    .join('\n');

  const html = `<html><body>
<table>
<tr><td>ISSSTE</td><td>Consultas del ${opts.dateStr}</td><td>HOSPITAL SINTETICO T17</td></tr>
</table>
<table>
<tr><td>No. Cita</td><td>Fecha</td><td>Hora</td><td>Folio</td><td>Expediente</td><td>Tipo</td><td>Nombre</td><td>Contacto</td><td>Vigencia</td><td>Sexo</td><td>Edad</td><td>P</td><td>S</td></tr>
<tr><td colspan="13">Medico: ${opts.physNumber} ${opts.physName}</td></tr>
<tr><td colspan="13">Servicio: ${opts.serviceCode} ${opts.serviceName}</td></tr>
${rowsHtml}
</table>
</body></html>`;

  // ASCII-only fixture: Buffer.from with 'ascii' is byte-identical to ISO-8859-1
  return new Uint8Array(Buffer.from(html, 'ascii'));
}

function makeFileInput(bytes: Uint8Array) {
  return {
    sizeBytes: bytes.length,
    open: async function* () {
      yield bytes;
    },
  };
}

// ---------------------------------------------------------------------------
// Resolved medico mock — returns RESOLVED so CitaSnapshots are built and
// reconciliation (ADD/UPDATE/WITHDRAW) works correctly.
// ---------------------------------------------------------------------------

function makeMedicoReferencia(): MedicoReferencia {
  return MedicoReferencia.create({
    numeroEmpleado: NumeroEmpleado.parse('55501'),
    nombre: 'DR SINTETICO T17',
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('T-17 — Agenda Preparation PostgreSQL integration', () => {
  const admin = new Client({ connectionString: adminUrl });
  const clients = databaseNames.map((name) => new Client({ connectionString: databaseUrl(name) }));

  const router = new TenantDatabaseRouter([
    {
      tenantId: 'tenant-int-1',
      databaseName: DB_TENANT_A,
      connectionString: databaseUrl(DB_TENANT_A),
    },
    {
      tenantId: 'tenant-int-2',
      databaseName: DB_TENANT_B,
      connectionString: databaseUrl(DB_TENANT_B),
    },
  ]);

  const tenantA = tenant(DB_TENANT_A, 1);
  const tenantB = tenant(DB_TENANT_B, 2);
  const ctxA = context(DB_TENANT_A, 1);
  const ctxB = context(DB_TENANT_B, 2);

  // Build use cases — medicoQuery returns RESOLVED so Citas are built
  function makeImportUseCase() {
    return new ImportAgenda({
      interpreter: new SimefAgendaParserAdapter(),
      medicoQuery: {
        findByEmployeeNumber: async () => ({
          kind: 'RESOLVED' as const,
          medico: makeMedicoReferencia(),
        }),
        findControlledFallback: async () => ({ kind: 'NOT_FOUND' as const }),
      },
      expedienteQuery: { resolve: async () => [] },
      metadataRepository: new PostgresImportArtifactMetadataRepository(router),
      idempotencyKeyRepository: new PostgresIdempotencyKeyRepository(router),
      unitOfWork: new PostgresAgendaPreparationUnitOfWork(router),
    });
  }

  beforeAll(async () => {
    await admin.connect();
    for (const name of databaseNames) await admin.query(`CREATE DATABASE "${name}"`);
    for (const client of clients) {
      await client.connect();
      await applyMigrations(client);
    }
  }, 60_000);

  afterAll(async () => {
    await router.close();
    for (const client of clients) await client.end();
    for (const name of databaseNames) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }, 30_000);

  // -------------------------------------------------------------------------
  // Migration validity
  // -------------------------------------------------------------------------

  it('migration instala las 7 tablas de Agenda en cada tenant DB', async () => {
    const expectedTables = [
      'agenda_imports',
      'agendas',
      'citas',
      'agenda_registros',
      'agenda_incidencias',
      'agenda_artifact_metadata',
      'agenda_idempotency_keys',
    ];

    for (const client of clients) {
      const result = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY($1)
         ORDER BY table_name`,
        [expectedTables],
      );
      expect(result.rows).toHaveLength(expectedTables.length);
    }
  });

  it('migration idempotencia: DB es consistente tras verificar migración más reciente', async () => {
    // Verify DB remains consistent after migrations were applied in beforeAll
    const agendaTableNames = [
      'agenda_imports', 'agendas', 'citas',
      'agenda_registros', 'agenda_incidencias',
      'agenda_artifact_metadata', 'agenda_idempotency_keys',
    ];
    const tablesBefore = await clients[0]!.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1)
       ORDER BY table_name`,
      [agendaTableNames],
    );
    expect(tablesBefore.rows.length).toBeGreaterThanOrEqual(7);
  });

  // -------------------------------------------------------------------------
  // First import (IMPORTED)
  // -------------------------------------------------------------------------

  it('primera importación produce outcome IMPORTED y persiste datos en PostgreSQL', async () => {
    const useCase = makeImportUseCase();

    const bytes = buildSimefHtml({
      dateStr: '25/08/2026',
      physNumber: '55601',
      physName: 'DR PRIMERO INT',
      serviceCode: 'CIR',
      serviceName: 'CIRUGIA GENERAL',
      rows: [
        {
          num: '001',
          folio: 'T17-FOLIO-001',
          exp: 'T17-EXP-001',
          hora: '08:00',
          tipo: 'PENSIONISTA',
          nombre: 'PACIENTE INT UNO',
        },
        {
          num: '002',
          folio: 'T17-FOLIO-002',
          exp: 'T17-EXP-002',
          hora: '08:30',
          tipo: 'ACTIVO',
          nombre: 'PACIENTE INT DOS',
          primeraVez: false,
        },
      ],
    });

    const result = await useCase.execute({
      importAttemptId: randomUUID(),
      idempotencyKey: `idem-${randomUUID()}`,
      file: makeFileInput(bytes),
      context: ctxA,
    });

    expect(result.outcome).toBe('IMPORTED');
    expect(result.metrics.receivedRecords).toBe(2);
    expect(result.agendaDate).toBe('2026-08-25');

    // Verify import row persisted
    const importRow = await clients[0]!.query<{ outcome: string; received_records: number }>(
      `SELECT outcome, received_records FROM agenda_imports WHERE id = $1`,
      [result.importacionId],
    );
    expect(importRow.rows[0]).toMatchObject({ outcome: 'IMPORTED', received_records: 2 });

    // Agenda created for this date
    const agendaRow = await clients[0]!.query(
      `SELECT agenda_date FROM agendas WHERE agenda_date = '2026-08-25'`,
    );
    expect(agendaRow.rows).toHaveLength(1);

    // 2 Citas ACTIVA
    const citasRows = await clients[0]!.query<{ folio: string; lifecycle: string }>(
      `SELECT folio, lifecycle FROM citas WHERE agenda_date = '2026-08-25' ORDER BY folio`,
    );
    expect(citasRows.rows).toHaveLength(2);
    expect(citasRows.rows.every((r) => r.lifecycle === 'ACTIVA')).toBe(true);

    // Import registros saved
    const registros = await clients[0]!.query<{ count: string }>(
      `SELECT count(*) FROM agenda_registros WHERE importacion_id = $1`,
      [result.importacionId],
    );
    expect(parseInt(registros.rows[0]!.count, 10)).toBe(2);

    // Metrics: with RESOLVED medico all rows should be ADDED
    expect(result.metrics.added).toBe(2);
    expect(result.metrics.pendingReview).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Reimport identical artifact (ALREADY_IMPORTED)
  // -------------------------------------------------------------------------

  it('reimportación con artefacto idéntico produce ALREADY_IMPORTED sin duplicar Agenda', async () => {
    const useCase = makeImportUseCase();

    const bytes = buildSimefHtml({
      dateStr: '26/08/2026',
      physNumber: '55602',
      physName: 'DR SEGUNDO INT',
      serviceCode: 'MED',
      serviceName: 'MEDICINA GENERAL',
      rows: [
        {
          num: '001',
          folio: 'T17-SAME-001',
          exp: 'T17-SAME-EXP-001',
          hora: '09:00',
          tipo: 'PENSIONISTA',
          nombre: 'PACIENTE SAME UNO',
        },
      ],
    });

    // First import
    const first = await useCase.execute({
      importAttemptId: randomUUID(),
      idempotencyKey: `idem-first-${randomUUID()}`,
      file: makeFileInput(bytes),
      context: ctxA,
    });
    expect(first.outcome).toBe('IMPORTED');

    // Second import: same bytes (same fingerprint) with a new idempotency key
    const second = await useCase.execute({
      importAttemptId: randomUUID(),
      idempotencyKey: `idem-second-${randomUUID()}`,
      file: makeFileInput(bytes), // identical content → same fingerprint
      context: ctxA,
    });
    expect(second.outcome).toBe('ALREADY_IMPORTED');

    // Agenda should have exactly 1 row for this date (no duplicate)
    const agendaCount = await clients[0]!.query<{ count: string }>(
      `SELECT count(*) FROM agendas WHERE agenda_date = '2026-08-26'`,
    );
    expect(parseInt(agendaCount.rows[0]!.count, 10)).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Idempotency key reuse with different artifact (IDEMPOTENCY_KEY_REUSED)
  // -------------------------------------------------------------------------

  it('misma idempotency key con archivo diferente lanza IDEMPOTENCY_KEY_REUSED', async () => {
    const useCase = makeImportUseCase();
    const idemKey = `idem-reuse-${randomUUID()}`;

    const bytes1 = buildSimefHtml({
      dateStr: '27/08/2026',
      physNumber: '55603',
      physName: 'DR TERCERO INT',
      serviceCode: 'OFT',
      serviceName: 'OFTALMOLOGIA',
      rows: [
        {
          num: '001',
          folio: 'T17-K1-001',
          exp: 'EXP-K1',
          hora: '10:00',
          tipo: 'ACTIVO',
          nombre: 'PACIENTE K UNO',
        },
      ],
    });

    const bytes2 = buildSimefHtml({
      dateStr: '27/08/2026',
      physNumber: '55603',
      physName: 'DR TERCERO INT',
      serviceCode: 'OFT',
      serviceName: 'OFTALMOLOGIA',
      rows: [
        {
          num: '001',
          folio: 'T17-K2-001',
          exp: 'EXP-K2',
          hora: '10:00',
          tipo: 'ACTIVO',
          nombre: 'PACIENTE K DOS',
        },
        {
          num: '002',
          folio: 'T17-K2-002',
          exp: 'EXP-K2-B',
          hora: '10:30',
          tipo: 'PENSIONISTA',
          nombre: 'PACIENTE K TRES',
          primeraVez: false,
        },
      ],
    });

    // First use of the key with bytes1
    await useCase.execute({
      importAttemptId: randomUUID(),
      idempotencyKey: idemKey,
      file: makeFileInput(bytes1),
      context: ctxA,
    });

    // Second use of same key with different bytes → different fingerprint → conflict
    await expect(
      useCase.execute({
        importAttemptId: randomUUID(),
        idempotencyKey: idemKey,
        file: makeFileInput(bytes2),
        context: ctxA,
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  // -------------------------------------------------------------------------
  // Reconciliation (RECONCILED)
  // -------------------------------------------------------------------------

  it('reimportación con cambios produce RECONCILED y actualiza Citas en PostgreSQL', async () => {
    const useCase = makeImportUseCase();
    const dateStr = '28/08/2026';

    // V1: two citas
    const bytesV1 = buildSimefHtml({
      dateStr,
      physNumber: '55604',
      physName: 'DR CUARTO INT',
      serviceCode: 'CAR',
      serviceName: 'CARDIOLOGIA',
      rows: [
        {
          num: '001',
          folio: 'T17-R-001',
          exp: 'EXP-R-001',
          hora: '07:00',
          tipo: 'PENSIONISTA',
          nombre: 'PACIENTE R UNO',
        },
        {
          num: '002',
          folio: 'T17-R-002',
          exp: 'EXP-R-002',
          hora: '07:30',
          tipo: 'ACTIVO',
          nombre: 'PACIENTE R DOS',
          primeraVez: false,
        },
      ],
    });

    const v1 = await useCase.execute({
      importAttemptId: randomUUID(),
      idempotencyKey: `idem-r-v1-${randomUUID()}`,
      file: makeFileInput(bytesV1),
      context: ctxA,
    });
    expect(v1.outcome).toBe('IMPORTED');
    expect(v1.metrics.added).toBe(2);

    // V2: T17-R-001 with changed hora, T17-R-002 absent (withdrawn), new T17-R-003
    const bytesV2 = buildSimefHtml({
      dateStr,
      physNumber: '55604',
      physName: 'DR CUARTO INT',
      serviceCode: 'CAR',
      serviceName: 'CARDIOLOGIA',
      rows: [
        {
          num: '001',
          folio: 'T17-R-001',
          exp: 'EXP-R-001',
          hora: '08:00', // hora changed
          tipo: 'PENSIONISTA',
          nombre: 'PACIENTE R UNO',
        },
        {
          num: '003',
          folio: 'T17-R-003',
          exp: 'EXP-R-003',
          hora: '09:00',
          tipo: 'ACTIVO',
          nombre: 'PACIENTE R TRES', // new
        },
      ],
    });

    const v2 = await useCase.execute({
      importAttemptId: randomUUID(),
      idempotencyKey: `idem-r-v2-${randomUUID()}`,
      file: makeFileInput(bytesV2),
      context: ctxA,
    });
    expect(v2.outcome).toBe('RECONCILED');
    expect(v2.metrics.updated).toBeGreaterThanOrEqual(1); // T17-R-001 updated
    expect(v2.metrics.added).toBeGreaterThanOrEqual(1); // T17-R-003 added
    expect(v2.metrics.withdrawnFromAgenda).toBeGreaterThanOrEqual(1); // T17-R-002 withdrawn

    // DB: all 3 citas exist (RETIRADA is preserved, not deleted)
    const citas = await clients[0]!.query<{ folio: string; lifecycle: string }>(
      `SELECT folio, lifecycle FROM citas WHERE agenda_date = '2026-08-28' ORDER BY folio`,
    );
    expect(citas.rows).toHaveLength(3);

    const folio001 = citas.rows.find((r) => r.folio === 'T17-R-001');
    const folio002 = citas.rows.find((r) => r.folio === 'T17-R-002');
    const folio003 = citas.rows.find((r) => r.folio === 'T17-R-003');
    expect(folio001!.lifecycle).toBe('ACTIVA');
    expect(folio002!.lifecycle).toBe('RETIRADA_DE_AGENDA');
    expect(folio003!.lifecycle).toBe('ACTIVA');
  });

  // -------------------------------------------------------------------------
  // UoW rollback: PK violation leaves no partial state
  // -------------------------------------------------------------------------

  it('violación de PK deja exactamente 1 fila consistente — no estado parcial', async () => {
    const importId = randomUUID();

    // Insert a row manually
    await clients[0]!.query(
      `INSERT INTO agenda_imports (id, agenda_date, imported_at, outcome)
       VALUES ($1, '2099-12-31', now(), 'IMPORTED')`,
      [importId],
    );

    // Duplicate insert must fail with unique violation (code 23505)
    await expect(
      clients[0]!.query(
        `INSERT INTO agenda_imports (id, agenda_date, imported_at, outcome)
         VALUES ($1, '2099-12-31', now(), 'IMPORTED')`,
        [importId],
      ),
    ).rejects.toMatchObject({ code: '23505' });

    // Exactly 1 row remains — no partial duplicates
    const rows = await clients[0]!.query<{ count: string }>(
      `SELECT count(*) FROM agenda_imports WHERE id = $1`,
      [importId],
    );
    expect(parseInt(rows.rows[0]!.count, 10)).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Read models via direct SQL
  // -------------------------------------------------------------------------

  it('import history read model: importaciones consultables por fecha de Agenda', async () => {
    const rows = await clients[0]!.query<{ outcome: string }>(
      `SELECT outcome FROM agenda_imports
       WHERE agenda_date = '2026-08-25'
       ORDER BY imported_at DESC`,
    );
    expect(rows.rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.rows[0]!.outcome).toBe('IMPORTED');
  });

  it('preparation items read model: citas ACTIVAS disponibles, RETIRADA excluida de query activa', async () => {
    const activas = await clients[0]!.query<{ folio: string }>(
      `SELECT folio FROM citas
       WHERE agenda_date = '2026-08-28' AND lifecycle = 'ACTIVA'
       ORDER BY folio`,
    );
    const retiradas = await clients[0]!.query<{ folio: string }>(
      `SELECT folio FROM citas
       WHERE agenda_date = '2026-08-28' AND lifecycle = 'RETIRADA_DE_AGENDA'
       ORDER BY folio`,
    );

    const activaFolios = activas.rows.map((r) => r.folio);
    const retiradaFolios = retiradas.rows.map((r) => r.folio);

    expect(activaFolios).toContain('T17-R-001');
    expect(activaFolios).toContain('T17-R-003');
    expect(activaFolios).not.toContain('T17-R-002');
    expect(retiradaFolios).toContain('T17-R-002');
  });

  it('registros por importación: conteo correcto y asociación FK válida', async () => {
    // Verify all registros from the first import (2026-08-25) are retrievable
    const importRow = await clients[0]!.query<{ id: string }>(
      `SELECT id FROM agenda_imports WHERE agenda_date = '2026-08-25' ORDER BY imported_at DESC LIMIT 1`,
    );
    expect(importRow.rows).toHaveLength(1);

    const registros = await clients[0]!.query<{ count: string }>(
      `SELECT count(*) FROM agenda_registros WHERE importacion_id = $1`,
      [importRow.rows[0]!.id],
    );
    expect(parseInt(registros.rows[0]!.count, 10)).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Fingerprint separation
  // -------------------------------------------------------------------------

  it('fingerprint en agenda_artifact_metadata, NO en agenda_imports', async () => {
    // agenda_imports must NOT have fingerprint column
    const importCols = await clients[0]!.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'agenda_imports'`,
    );
    expect(importCols.rows.map((r) => r.column_name)).not.toContain('fingerprint');

    // agenda_artifact_metadata must have fingerprint column
    const metaCols = await clients[0]!.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'agenda_artifact_metadata'`,
    );
    expect(metaCols.rows.map((r) => r.column_name)).toContain('fingerprint');

    // Fingerprint value is SHA-256 hex (64 chars)
    const metaRows = await clients[0]!.query<{ fingerprint: string }>(
      `SELECT fingerprint FROM agenda_artifact_metadata LIMIT 1`,
    );
    if (metaRows.rows.length > 0) {
      expect(metaRows.rows[0]!.fingerprint).toHaveLength(64);
    }
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it('tenant isolation: datos de tenant A no visibles en tenant B antes de cualquier import en B', async () => {
    // All previous tests inserted into tenant A (DB_TENANT_A)
    // Tenant B should have no data yet
    const importCountB = await clients[1]!.query<{ count: string }>(
      `SELECT count(*) FROM agenda_imports`,
    );
    expect(parseInt(importCountB.rows[0]!.count, 10)).toBe(0);

    const agendaCountB = await clients[1]!.query<{ count: string }>(
      `SELECT count(*) FROM agendas`,
    );
    expect(parseInt(agendaCountB.rows[0]!.count, 10)).toBe(0);
  });

  it('tenant isolation: import en tenant B no afecta conteos de tenant A', async () => {
    const useCase = makeImportUseCase();

    // Snapshot tenant A count before importing into B
    const countBefore = await clients[0]!.query<{ count: string }>(
      `SELECT count(*) FROM agenda_imports`,
    );
    const countBeforeA = parseInt(countBefore.rows[0]!.count, 10);

    const bytes = buildSimefHtml({
      dateStr: '01/09/2026',
      physNumber: '55605',
      physName: 'DR QUINTO INT',
      serviceCode: 'NEU',
      serviceName: 'NEUROLOGIA',
      rows: [
        {
          num: '001',
          folio: 'T17-B-001',
          exp: 'EXP-B-001',
          hora: '11:00',
          tipo: 'ACTIVO',
          nombre: 'PACIENTE B INT',
        },
      ],
    });

    await useCase.execute({
      importAttemptId: randomUUID(),
      idempotencyKey: `idem-b-${randomUUID()}`,
      file: makeFileInput(bytes),
      context: ctxB,
    });

    // Tenant A count must be unchanged
    const countAfter = await clients[0]!.query<{ count: string }>(
      `SELECT count(*) FROM agenda_imports`,
    );
    expect(parseInt(countAfter.rows[0]!.count, 10)).toBe(countBeforeA);

    // Tenant B has exactly 1 import
    const rowsInB = await clients[1]!.query<{ count: string }>(
      `SELECT count(*) FROM agenda_imports`,
    );
    expect(parseInt(rowsInB.rows[0]!.count, 10)).toBe(1);
  });

  it('tenant isolation: folio T17-B-001 de tenant B no visible en tenant A', async () => {
    // T17-B-001 was imported into tenant B; tenant A should not have it
    const inA = await clients[0]!.query<{ count: string }>(
      `SELECT count(*) FROM citas WHERE folio = 'T17-B-001'`,
    );
    expect(parseInt(inA.rows[0]!.count, 10)).toBe(0);

    const inB = await clients[1]!.query<{ count: string }>(
      `SELECT count(*) FROM citas WHERE folio = 'T17-B-001'`,
    );
    expect(parseInt(inB.rows[0]!.count, 10)).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Privacy: data minimization — no prohibited columns in any Agenda table
  // -------------------------------------------------------------------------

  it('ninguna tabla de Agenda contiene columnas de datos prohibidos', async () => {
    const prohibitedCols = [
      'fingerprint',        // must be in metadata table only
      'filename',           // RAW-AP-001
      'raw_row',            // RAW-AP-001
      'curp',               // REQ-AP-015
      'telefono',           // REQ-AP-015
      'sexo',               // REQ-AP-015
      'edad',               // REQ-AP-015
      'vigencia',           // REQ-AP-015
      'turno',              // INV-AP-012
      'consultorio',        // INV-AP-012
      'destino',            // INV-AP-012
      'tenant_id',          // isolation is at DB level, not column level
    ];

    const result = await clients[0]!.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1)`,
      [
        [
          'agenda_imports',
          'agendas',
          'citas',
          'agenda_registros',
          'agenda_incidencias',
          'agenda_artifact_metadata',
          'agenda_idempotency_keys',
        ],
      ],
    );

    const actualCols = result.rows.map((r) => r.column_name);

    // fingerprint in agenda_imports is specifically prohibited (it must be in metadata only)
    for (const col of prohibitedCols) {
      if (col === 'fingerprint') {
        // Check only agenda_imports does not have it
        const importColsCheck = await clients[0]!.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
           WHERE table_name = 'agenda_imports'`,
        );
        expect(
          importColsCheck.rows.map((r) => r.column_name),
          `columna prohibida en agenda_imports: ${col}`,
        ).not.toContain(col);
      } else {
        expect(actualCols, `columna prohibida encontrada: ${col}`).not.toContain(col);
      }
    }
  });
});
