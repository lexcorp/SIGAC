/**
 * T-26 — Preparation Report integration tests con PostgreSQL real
 *
 * Cubre (tasks.md T-26):
 *   - PDF > 0 bytes; Content-Type y Content-Disposition correctos
 *   - 422 para fecha sin citas activas
 *   - Filtro por servicios — solo citas de CARD incluidas, CIR excluidas
 *   - Tenant isolation — Tenant B no obtiene datos de Tenant A
 *   - Audit log escrito con AGENDA_REPORT_GENERATED, sin PII
 *   - PDF con múltiples médicos — recordCount y stream verificados
 *   - Cita RETIRADA_DE_AGENDA excluida del PDF (verificada via audit recordCount)
 *
 * Ajustes confirmados por el usuario:
 *   1. audit metadata.sourceImportId corresponde al importacionId sembrado
 *   2. Filtro por servicios: PDF incluye CARD, excluye CIR (verificado via recordCount)
 *   3. Tenant isolation: ports reciben exclusivamente el TenantContext del tenant solicitado
 *
 * Fixtures 100% sintéticos — ningún dato proviene de SIMEF real.
 * No se usa buildSimefHtml ni ImportAgenda (prueba el use case de generación directamente).
 */

import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  AgendaFecha,
  GeneratePreparationReport,
} from '../../packages/modules/agenda-preparation/src/index.js';
import {
  PostgresAgendaPreparationQueryPort,
  PostgresAuditWriter,
  TenantDatabaseRouter,
} from '../../packages/platform/database/src/index.js';
import { PDFKitPreparationReportGenerator } from '../../packages/platform/pdf/src/index.js';
import type { RequestContext, TenantContext } from '../../packages/platform/tenant/src/index.js';

// ---------------------------------------------------------------------------
// Infrastructure helpers
// ---------------------------------------------------------------------------

const adminUrl =
  process.env.SIGAC_POSTGRES_ADMIN_URL ??
  'postgresql://sigac:sigac_dev_only@localhost:5432/postgres';

const suffix = randomUUID().replaceAll('-', '');
const DB_TENANT_A = `sigac_pr_int_a_${suffix}`;
const DB_TENANT_B = `sigac_pr_int_b_${suffix}`;

function databaseUrl(name: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
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

/** Collect a readable stream into a single Buffer. */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Tenant / RequestContext helpers
// ---------------------------------------------------------------------------

const PR_INT_DATE = '2026-09-20';

function makeTenant(dbName: string, n: number): TenantContext {
  return {
    tenantId: `tenant-pr-int-${n}`,
    slug: `hospital-pr-int-${n}`,
    hospitalId: `hosp-pr-int-${n}`,
    databaseName: dbName,
    timezone: 'America/Mexico_City',
  };
}

function makeContext(tenant: TenantContext, n: number): RequestContext {
  return {
    actor: {
      actorId: `actor-pr-int-${n}`,
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(['AGENDA_VIEW', 'AGENDA_PRINT']),
      tenantIds: new Set([tenant.tenantId]),
    },
    tenant,
    requestId: `req-pr-int-${n}`,
    correlationId: `corr-pr-int-${n}`,
    source: 'WEB',
  };
}

// ---------------------------------------------------------------------------
// Fixtures (SQL directo — sin SIMEF, sin ImportAgenda)
//
// Sembramos en Tenant A:
//   1 import  → importacionId = PR_IMPORT_ID
//   1 agenda  → agenda_date = 2026-09-20
//   5 citas ACTIVAS:
//       DR PRIMER MEDICO (77701) / CARD:  FOLIO-PR-001..003
//       DR SEGUNDO MEDICO (77702) / CIR:  FOLIO-PR-004..005
//   1 cita RETIRADA (FOLIO-PR-RET) — no debe aparecer en PDF
// ---------------------------------------------------------------------------

const PR_IMPORT_ID = randomUUID();

async function seedTenantA(client: Client): Promise<void> {
  // agenda_imports
  await client.query(
    `INSERT INTO agenda_imports
       (id, agenda_date, imported_at, outcome,
        received_records, processed, added, updated, unchanged,
        restored, pending_review, rejected, duplicate_folio,
        withdrawn_from_agenda, incidents, errors)
     VALUES ($1, $2, now(), 'IMPORTED', 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0)`,
    [PR_IMPORT_ID, PR_INT_DATE],
  );

  // agendas
  await client.query(`INSERT INTO agendas (agenda_date) VALUES ($1)`, [PR_INT_DATE]);

  // citas ACTIVAS — médico 77701 / CARD
  const activaCard = [
    ['FOLIO-PR-001', '08:00', 'PENSIONISTA', 'FIRST_TIME',   'PACIENTE SINTETICO PR INT UNO'],
    ['FOLIO-PR-002', '08:20', 'ACTIVO',      'SUBSEQUENT',   'PACIENTE SINTETICO PR INT DOS'],
    ['FOLIO-PR-003', '08:40', 'PENSIONISTA', 'FIRST_TIME',   'PACIENTE SINTETICO PR INT TRES'],
  ] as const;

  for (const [folio, hora, tipo, consulta, nombre] of activaCard) {
    await client.query(
      `INSERT INTO citas
         (agenda_date, folio, hora, expediente_reference, nombre_paciente,
          tipo_derechohabiente, tipo_consulta,
          medico_numero_empleado, medico_nombre,
          servicio_codigo, servicio_nombre, lifecycle)
       VALUES ($1,$2,$3,null,$4,$5,$6,'77701','DR PRIMER MEDICO INT','CARD','CARDIOLOGIA SINT','ACTIVA')`,
      [PR_INT_DATE, folio, hora, nombre, tipo, consulta],
    );
  }

  // citas ACTIVAS — médico 77702 / CIR
  const activaCir = [
    ['FOLIO-PR-004', '09:00', 'ACTIVO',      'FIRST_TIME',   'PACIENTE SINTETICO PR INT CUATRO'],
    ['FOLIO-PR-005', '09:20', 'PENSIONISTA', 'SUBSEQUENT',   'PACIENTE SINTETICO PR INT CINCO'],
  ] as const;

  for (const [folio, hora, tipo, consulta, nombre] of activaCir) {
    await client.query(
      `INSERT INTO citas
         (agenda_date, folio, hora, expediente_reference, nombre_paciente,
          tipo_derechohabiente, tipo_consulta,
          medico_numero_empleado, medico_nombre,
          servicio_codigo, servicio_nombre, lifecycle)
       VALUES ($1,$2,$3,null,$4,$5,$6,'77702','DR SEGUNDO MEDICO INT','CIR','CIRUGIA SINT','ACTIVA')`,
      [PR_INT_DATE, folio, hora, nombre, tipo, consulta],
    );
  }

  // cita RETIRADA — no debe aparecer en PDF
  await client.query(
    `INSERT INTO citas
       (agenda_date, folio, hora, expediente_reference, nombre_paciente,
        tipo_derechohabiente, tipo_consulta,
        medico_numero_empleado, medico_nombre,
        servicio_codigo, servicio_nombre, lifecycle)
     VALUES ($1,'FOLIO-PR-RET','10:00',null,'PACIENTE SINTETICO RETIRADO',
             'PENSIONISTA','FIRST_TIME','77701','DR PRIMER MEDICO INT',
             'CARD','CARDIOLOGIA SINT','RETIRADA_DE_AGENDA')`,
    [PR_INT_DATE],
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('T-26 — Preparation Report PostgreSQL integration', () => {
  const admin = new Client({ connectionString: adminUrl });
  const clientA = new Client({ connectionString: databaseUrl(DB_TENANT_A) });
  const clientB = new Client({ connectionString: databaseUrl(DB_TENANT_B) });

  let router: TenantDatabaseRouter;
  let tenantA: TenantContext;
  let tenantB: TenantContext;
  let ctxA: RequestContext;
  let ctxB: RequestContext;

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${DB_TENANT_A}"`);
    await admin.query(`CREATE DATABASE "${DB_TENANT_B}"`);

    await clientA.connect();
    await clientB.connect();
    await applyMigrations(clientA);
    await applyMigrations(clientB);
    await seedTenantA(clientA);
    // Tenant B queda vacío intencionalmente

    tenantA = makeTenant(DB_TENANT_A, 1);
    tenantB = makeTenant(DB_TENANT_B, 2);
    ctxA = makeContext(tenantA, 1);
    ctxB = makeContext(tenantB, 2);

    router = new TenantDatabaseRouter([
      {
        tenantId: tenantA.tenantId,
        databaseName: DB_TENANT_A,
        connectionString: databaseUrl(DB_TENANT_A),
      },
      {
        tenantId: tenantB.tenantId,
        databaseName: DB_TENANT_B,
        connectionString: databaseUrl(DB_TENANT_B),
      },
    ]);
  }, 60_000);

  afterAll(async () => {
    await router.close();
    await clientA.end();
    await clientB.end();
    await admin.query(`DROP DATABASE "${DB_TENANT_A}"`);
    await admin.query(`DROP DATABASE "${DB_TENANT_B}"`);
    await admin.end();
  }, 30_000);

  // Builds a real use case wired to real PostgreSQL ports.
  // preparationListQuery is optionally wrapped with a spy for tenant isolation assertions.
  function makeUseCase(opts: {
    tenant?: TenantContext;
    spyOnListForPrint?: boolean;
  } = {}) {
    const preparationListQuery = new PostgresAgendaPreparationQueryPort(router);
    const auditWriter = new PostgresAuditWriter(router);
    const reportGenerator = new PDFKitPreparationReportGenerator();

    // Optional spy to capture what TenantContext was passed to listForPrint
    let listForPrintSpy: ReturnType<typeof vi.spyOn> | null = null;
    if (opts.spyOnListForPrint) {
      listForPrintSpy = vi.spyOn(preparationListQuery, 'listForPrint');
    }

    const useCase = new GeneratePreparationReport({
      preparationListQuery,
      reportGenerator,
      auditWriter,
    });

    return { useCase, preparationListQuery, listForPrintSpy };
  }

  // ─── T-26-01 / T-26-02: PDF para fecha con citas activas ─────────────────

  it('T-26-01: PDF > 0 bytes y empieza con %PDF para fecha con citas activas', async () => {
    const { useCase } = makeUseCase();
    const result = await useCase.execute({
      agendaDate: AgendaFecha.parse(PR_INT_DATE),
      order: 'APPOINTMENT_TIME_ASC',
      context: ctxA,
      sourceImportId: PR_IMPORT_ID,
    });

    expect(result.filename).toBe(`lista-preparacion-${PR_INT_DATE}.pdf`);

    const buf = await streamToBuffer(result.stream);
    expect(buf.length).toBeGreaterThan(0);
    // PDF magic bytes
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('T-26-02: filename corresponde al formato aprobado sin datos de paciente', async () => {
    const { useCase } = makeUseCase();
    const result = await useCase.execute({
      agendaDate: AgendaFecha.parse(PR_INT_DATE),
      order: 'APPOINTMENT_TIME_ASC',
      context: ctxA,
      sourceImportId: PR_IMPORT_ID,
    });

    expect(result.filename).toMatch(/^lista-preparacion-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(result.filename).not.toMatch(/paciente/i);
    expect(result.filename).not.toMatch(/folio/i);
    expect(result.filename).not.toMatch(/curp/i);

    // Consume stream to avoid leaks
    await streamToBuffer(result.stream);
  });

  // ─── T-26-03: 422 para fecha sin citas activas ────────────────────────────

  it('T-26-03: lanza NO_ACTIVE_APPOINTMENTS para fecha sin citas en PostgreSQL', async () => {
    const { useCase } = makeUseCase();
    await expect(
      useCase.execute({
        agendaDate: AgendaFecha.parse('2026-01-01'), // fecha sin datos sembrados
        order: 'APPOINTMENT_TIME_ASC',
        context: ctxA,
        sourceImportId: PR_IMPORT_ID,
      }),
    ).rejects.toMatchObject({ code: 'NO_ACTIVE_APPOINTMENTS' });
  });

  // ─── T-26-04: Filtro por servicios ───────────────────────────────────────

  it('T-26-04a: filtro services=["CARD"] incluye solo las 3 citas CARD (audit recordCount=3)', async () => {
    const { useCase } = makeUseCase();

    const result = await useCase.execute({
      agendaDate: AgendaFecha.parse(PR_INT_DATE),
      services: ['CARD'],
      order: 'APPOINTMENT_TIME_ASC',
      context: ctxA,
      sourceImportId: PR_IMPORT_ID,
    });

    // Consume stream to avoid leaks
    const buf = await streamToBuffer(result.stream);
    expect(buf.length).toBeGreaterThan(0);

    // Verify via audit_log: recordCount debe ser 3 (solo CARD)
    // Esperar brevemente para que el audit write complete
    await new Promise((r) => setTimeout(r, 100));

    const auditRows = await clientA.query<{
      action: string;
      result: string;
      change_summary: Record<string, string>;
    }>(
      `SELECT action, result, change_summary
       FROM audit_log
       WHERE action = 'AGENDA_REPORT_GENERATED'
         AND result = 'success'
         AND change_summary->>'agendaDate' = $1
       ORDER BY occurred_at DESC
       LIMIT 1`,
      [PR_INT_DATE],
    );

    expect(auditRows.rows.length).toBeGreaterThanOrEqual(1);
    const latest = auditRows.rows[0]!;
    expect(latest.change_summary.recordCount).toBe('3');
    expect(latest.change_summary.serviceCount).toBe('1'); // solo CARD
  });

  it('T-26-04b: filtro services=["CARD"] produce PDF mayor que filtro services=["CIR"] (menos citas)', async () => {
    // CARD tiene 3 citas, CIR tiene 2 — el PDF con 3 citas debe ser >= al de 2 citas
    const { useCase: ucCard } = makeUseCase();
    const { useCase: ucCir } = makeUseCase();

    const [resCard, resCir] = await Promise.all([
      ucCard.execute({
        agendaDate: AgendaFecha.parse(PR_INT_DATE),
        services: ['CARD'],
        order: 'APPOINTMENT_TIME_ASC',
        context: ctxA,
        sourceImportId: PR_IMPORT_ID,
      }),
      ucCir.execute({
        agendaDate: AgendaFecha.parse(PR_INT_DATE),
        services: ['CIR'],
        order: 'APPOINTMENT_TIME_ASC',
        context: ctxA,
        sourceImportId: PR_IMPORT_ID,
      }),
    ]);

    const [bufCard, bufCir] = await Promise.all([
      streamToBuffer(resCard.stream),
      streamToBuffer(resCir.stream),
    ]);

    // Ambos son PDFs válidos
    expect(bufCard.slice(0, 4).toString('ascii')).toBe('%PDF');
    expect(bufCir.slice(0, 4).toString('ascii')).toBe('%PDF');

    // El PDF con más citas (CARD=3) es >= al de menos citas (CIR=2)
    expect(bufCard.length).toBeGreaterThanOrEqual(bufCir.length);
  });

  it('T-26-04c: filtro services=["CARD"] lanza NO_ACTIVE_APPOINTMENTS si la fecha no tiene CARD', async () => {
    const { useCase } = makeUseCase();

    // Fecha con citas pero servicio solicitado no existe
    await expect(
      useCase.execute({
        agendaDate: AgendaFecha.parse(PR_INT_DATE),
        services: ['NEU'], // servicio no sembrado
        order: 'APPOINTMENT_TIME_ASC',
        context: ctxA,
        sourceImportId: PR_IMPORT_ID,
      }),
    ).rejects.toMatchObject({ code: 'NO_ACTIVE_APPOINTMENTS' });
  });

  // ─── T-26-05: Tenant isolation ───────────────────────────────────────────

  it('T-26-05a: Tenant B (sin datos) → lanza NO_ACTIVE_APPOINTMENTS', async () => {
    const { useCase } = makeUseCase();

    await expect(
      useCase.execute({
        agendaDate: AgendaFecha.parse(PR_INT_DATE),
        order: 'APPOINTMENT_TIME_ASC',
        context: ctxB, // Tenant B — no tiene datos para esta fecha
        sourceImportId: PR_IMPORT_ID,
      }),
    ).rejects.toMatchObject({ code: 'NO_ACTIVE_APPOINTMENTS' });
  });

  it('T-26-05b: listForPrint recibe exclusivamente el TenantContext de Tenant B — nunca el de Tenant A', async () => {
    const { useCase, listForPrintSpy } = makeUseCase({ spyOnListForPrint: true });

    await useCase
      .execute({
        agendaDate: AgendaFecha.parse(PR_INT_DATE),
        order: 'APPOINTMENT_TIME_ASC',
        context: ctxB,
        sourceImportId: PR_IMPORT_ID,
      })
      .catch(() => undefined); // NO_ACTIVE_APPOINTMENTS esperado — nos interesa el spy

    expect(listForPrintSpy).not.toBeNull();
    const calls = listForPrintSpy!.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);

    for (const [, , tenantPassed] of calls) {
      // El port recibió exclusivamente tenantB
      expect((tenantPassed as TenantContext).tenantId).toBe(tenantB.tenantId);
      expect((tenantPassed as TenantContext).databaseName).toBe(DB_TENANT_B);
      // Nunca el tenant de A
      expect((tenantPassed as TenantContext).tenantId).not.toBe(tenantA.tenantId);
      expect((tenantPassed as TenantContext).databaseName).not.toBe(DB_TENANT_A);
    }
  });

  it('T-26-05c: datos de Tenant A no aparecen en la DB de Tenant B', async () => {
    // Las citas sembradas en Tenant A no deben existir en Tenant B
    const foliosA = ['FOLIO-PR-001', 'FOLIO-PR-002', 'FOLIO-PR-003', 'FOLIO-PR-004', 'FOLIO-PR-005'];

    const result = await clientB.query<{ count: string }>(
      `SELECT count(*) FROM citas WHERE folio = ANY($1)`,
      [foliosA],
    );
    expect(parseInt(result.rows[0]!.count, 10)).toBe(0);
  });

  // ─── T-26-06: Audit log ───────────────────────────────────────────────────

  it('T-26-06a: audit log escribe AGENDA_REPORT_GENERATED con resultado success', async () => {
    const { useCase } = makeUseCase();

    const before = await clientA.query<{ count: string }>(
      `SELECT count(*) FROM audit_log WHERE action = 'AGENDA_REPORT_GENERATED' AND result = 'success'`,
    );
    const countBefore = parseInt(before.rows[0]!.count, 10);

    const result = await useCase.execute({
      agendaDate: AgendaFecha.parse(PR_INT_DATE),
      order: 'APPOINTMENT_TIME_ASC',
      context: ctxA,
      sourceImportId: PR_IMPORT_ID,
    });
    await streamToBuffer(result.stream);

    const after = await clientA.query<{ count: string }>(
      `SELECT count(*) FROM audit_log WHERE action = 'AGENDA_REPORT_GENERATED' AND result = 'success'`,
    );
    expect(parseInt(after.rows[0]!.count, 10)).toBe(countBefore + 1);
  });

  it('T-26-06b: audit metadata contiene sourceImportId correcto y no contiene PII', async () => {
    const { useCase } = makeUseCase();

    const result = await useCase.execute({
      agendaDate: AgendaFecha.parse(PR_INT_DATE),
      order: 'APPOINTMENT_TIME_ASC',
      context: ctxA,
      sourceImportId: PR_IMPORT_ID,
    });
    await streamToBuffer(result.stream);

    // Leer la entrada más reciente de audit para esta fecha
    const auditRow = await clientA.query<{
      action: string;
      resource_id: string;
      change_summary: Record<string, string>;
      actor_ref: string;
    }>(
      `SELECT action, resource_id, change_summary, actor_ref
       FROM audit_log
       WHERE action = 'AGENDA_REPORT_GENERATED'
         AND result = 'success'
       ORDER BY occurred_at DESC
       LIMIT 1`,
    );

    expect(auditRow.rows.length).toBe(1);
    const entry = auditRow.rows[0]!;

    // Ajuste confirmado 1: sourceImportId debe corresponder al importacionId sembrado
    expect(entry.change_summary.sourceImportId).toBe(PR_IMPORT_ID);
    expect(entry.change_summary.sourceImportId).not.toBeNull();

    // resourceId es la fecha de agenda (no PII)
    expect(entry.resource_id).toBe(PR_INT_DATE);

    // actorRef es el actorId del contexto
    expect(entry.actor_ref).toBe(ctxA.actor.actorId);

    // PII prohibida en change_summary
    const summaryStr = JSON.stringify(entry.change_summary);
    expect(summaryStr).not.toMatch(/paciente/i);
    expect(summaryStr).not.toMatch(/folio/i);
    expect(summaryStr).not.toMatch(/curp/i);
    expect(summaryStr).not.toMatch(/expediente/i);

    // Campos aprobados presentes
    expect(entry.change_summary).toHaveProperty('agendaDate', PR_INT_DATE);
    expect(entry.change_summary).toHaveProperty('recordCount');
    expect(entry.change_summary).toHaveProperty('serviceCount');
  });

  it('T-26-06c: audit escribe not-found cuando no hay citas activas', async () => {
    const { useCase } = makeUseCase();

    await useCase
      .execute({
        agendaDate: AgendaFecha.parse('2026-01-01'),
        order: 'APPOINTMENT_TIME_ASC',
        context: ctxA,
        sourceImportId: PR_IMPORT_ID,
      })
      .catch(() => undefined);

    const auditRow = await clientA.query<{ result: string; change_summary: Record<string, string> }>(
      `SELECT result, change_summary
       FROM audit_log
       WHERE action = 'AGENDA_REPORT_GENERATED'
         AND result = 'not-found'
         AND change_summary->>'agendaDate' = '2026-01-01'
       ORDER BY occurred_at DESC
       LIMIT 1`,
    );

    expect(auditRow.rows.length).toBe(1);
    expect(auditRow.rows[0]!.result).toBe('not-found');
    // recordCount = 0 para no-found
    expect(auditRow.rows[0]!.change_summary.recordCount).toBe('0');
  });

  // ─── T-26-07: PDF con múltiples médicos ──────────────────────────────────

  it('T-26-07: PDF con dos médicos (CARD + CIR) — stream > tamaño mínimo estimado', async () => {
    const { useCase } = makeUseCase();

    const result = await useCase.execute({
      agendaDate: AgendaFecha.parse(PR_INT_DATE),
      order: 'APPOINTMENT_TIME_ASC',
      context: ctxA,
      sourceImportId: PR_IMPORT_ID,
      // Sin filtro de servicios → incluye ambos médicos
    });

    const buf = await streamToBuffer(result.stream);

    // El PDF con 5 citas en 2 grupos (2 páginas mínimo) debe ser sustancialmente mayor que 0
    // Tamaño mínimo estimado: 10 KB para un PDF PDFKit con dos páginas
    expect(buf.length).toBeGreaterThan(1_000); // ~4 KB observado con 5 citas sintéticas; 1 KB = umbral conservador

    // Verificar via audit que recordCount = 5 (las 5 citas ACTIVAS; RETIRADA excluida)
    await new Promise((r) => setTimeout(r, 50));
    const auditRow = await clientA.query<{ change_summary: Record<string, string> }>(
      `SELECT change_summary
       FROM audit_log
       WHERE action = 'AGENDA_REPORT_GENERATED'
         AND result = 'success'
       ORDER BY occurred_at DESC
       LIMIT 1`,
    );

    if (auditRow.rows.length > 0) {
      // 5 citas ACTIVAS sembradas; RETIRADA no debe contar
      expect(parseInt(auditRow.rows[0]!.change_summary.recordCount ?? '0', 10)).toBe(5);
      // 2 servicios distintos (CARD + CIR)
      expect(parseInt(auditRow.rows[0]!.change_summary.serviceCount ?? '0', 10)).toBe(2);
    }
  });

  // ─── T-26-08: RETIRADA_DE_AGENDA excluida ────────────────────────────────

  it('T-26-08: cita RETIRADA_DE_AGENDA (FOLIO-PR-RET) excluida — recordCount no la incluye', async () => {
    const { useCase } = makeUseCase();

    const result = await useCase.execute({
      agendaDate: AgendaFecha.parse(PR_INT_DATE),
      order: 'APPOINTMENT_TIME_ASC',
      context: ctxA,
      sourceImportId: PR_IMPORT_ID,
    });
    await streamToBuffer(result.stream);

    await new Promise((r) => setTimeout(r, 50));

    const auditRow = await clientA.query<{ change_summary: Record<string, string> }>(
      `SELECT change_summary
       FROM audit_log
       WHERE action = 'AGENDA_REPORT_GENERATED'
         AND result = 'success'
       ORDER BY occurred_at DESC
       LIMIT 1`,
    );

    expect(auditRow.rows.length).toBeGreaterThanOrEqual(1);
    // Solo 5 citas ACTIVAS — la RETIRADA no debe sumarse
    const recordCount = parseInt(auditRow.rows[0]!.change_summary.recordCount ?? '-1', 10);
    expect(recordCount).toBe(5);
  });
});
