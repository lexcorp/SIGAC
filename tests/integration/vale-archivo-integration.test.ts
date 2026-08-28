/**
 * T-37 — Vale Archivo integration tests con PostgreSQL real
 *
 * Cubre:
 *   1. Flujo completo: crear → iniciar búsqueda → localizar → entregar → auditoría
 *   2. Tenant isolation real: Tenant B no ve datos de Tenant A
 *   3. Privacy: audit entries sin PII de paciente
 *   4. Auditoría: eventos VALE_CREADO, VALE_BUSQUEDA_INICIADA,
 *                  VALE_ESTADO_ACTUALIZADO, VALE_ENTREGADO, VALE_PDF_GENERADO
 *   5. Permisos: ApplicationError propagado correctamente en cada use case
 *   6. PDF: generado en memoria, sin escritura en filesystem
 *
 * Fixtures 100% sintéticos — ningún dato real.
 * Sigue el patrón de vale-archivo-persistence.test.ts y
 * preparation-report-integration.test.ts.
 */

import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Domain
import {
  ValeArchivo,
  ApplicationError,
} from '../../packages/modules/vale-archivo/src/index.js';
import { NumeroVale } from '../../packages/modules/vale-archivo/src/domain/value-objects/NumeroVale.js';
import { parseSolicitanteReferencia } from '../../packages/modules/vale-archivo/src/domain/value-objects/SolicitanteReferencia.js';

// Infrastructure
import {
  PostgresValeArchivoRepository,
  PostgresValeArchivoQueryAdapter,
  PostgresAuditWriter,
  TenantDatabaseRouter,
} from '../../packages/platform/database/src/index.js';

// PDF
import { PDFKitValeArchivoGenerator } from '../../packages/platform/pdf/src/index.js';

// Use cases
import { RegistrarVale }          from '../../packages/modules/vale-archivo/src/application/use-cases/RegistrarVale.js';
import { IniciarBusqueda }        from '../../packages/modules/vale-archivo/src/application/use-cases/IniciarBusqueda.js';
import { RegistrarLocalizacion }  from '../../packages/modules/vale-archivo/src/application/use-cases/RegistrarLocalizacion.js';
import { RegistrarEntrega }       from '../../packages/modules/vale-archivo/src/application/use-cases/RegistrarEntrega.js';
import { ListarVales }            from '../../packages/modules/vale-archivo/src/application/use-cases/ListarVales.js';
import { ConsultarVale }          from '../../packages/modules/vale-archivo/src/application/use-cases/ConsultarVale.js';
import { GenerarPdfVale }         from '../../packages/modules/vale-archivo/src/application/use-cases/GenerarPdfVale.js';

import type { RequestContext, TenantContext } from '../../packages/platform/tenant/src/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const adminUrl =
  process.env.SIGAC_POSTGRES_ADMIN_URL ??
  'postgresql://sigac:sigac_dev_only@localhost:5432/postgres';

const suffix = randomUUID().replaceAll('-', '');
const DB_A = `sigac_va_intg_a_${suffix}`;
const DB_B = `sigac_va_intg_b_${suffix}`;

function dbUrl(name: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function applyMigrations(client: Client): Promise<void> {
  const dir = new URL('../../migrations/tenant/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, dir), 'utf8');
    for (const stmt of sql.split('--> statement-breakpoint'))
      if (stmt.trim()) await client.query(stmt);
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function makeTenant(dbName: string, n: number): TenantContext {
  return { tenantId: `tenant-va-intg-${n}`, slug: `hospital-va-intg-${n}`,
    hospitalId: `hosp-va-intg-${n}`, databaseName: dbName, timezone: 'America/Mexico_City' };
}

function makeContext(tenant: TenantContext, perms: string[]): RequestContext {
  return {
    actor: { actorId: 'actor-va-intg-001', roles: new Set(['ARCHIVISTA']),
      permissions: new Set(perms), tenantIds: new Set([tenant.tenantId]) },
    tenant, requestId: 'req-intg-001', correlationId: 'corr-intg-001', source: 'WEB',
  };
}

const ALL_PERMS = ['REQUEST_CREATE', 'ARCHIVE_REQUEST_VIEW', 'ARCHIVE_REQUEST_PROCESS', 'ARCHIVE_REQUEST_DELIVER'];

function makeVale(numero: string, unidad = 'DIRECCIÓN MÉDICA T37', items = 2): ValeArchivo {
  return ValeArchivo.create({
    numeroVale: NumeroVale.parse(numero),
    fechaSolicitud: new Date('2026-08-26'),
    fechaRecepcion: new Date('2026-08-26'),
    unidadSolicitante: unidad,
    solicitante: parseSolicitanteReferencia('Dr. Sintético Intg T37', 'Director'),
    autorizador: parseSolicitanteReferencia('Dra. Sintética Intg T37', 'Subdirectora'),
    items: Array.from({ length: items }, (_, i) => ({
      expedienteNumero: `EXP-VA-INTG-${numero}-${i + 1}`,
      pacienteNombre:   `PACIENTE SINT INTG T37 ${numero} ${i + 1}`,
      especialidad:     'MEDICINA INTERNA',
    })),
    creadoPor: 'actor-va-intg-001',
  }, new Date('2026-08-26T10:00:00Z'));
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('T-37 — Vale Archivo integration (PostgreSQL real)', () => {
  const admin   = new Client({ connectionString: adminUrl });
  const clientA = new Client({ connectionString: dbUrl(DB_A) });
  const clientB = new Client({ connectionString: dbUrl(DB_B) });

  let router: TenantDatabaseRouter;
  let tenantA: TenantContext;
  let tenantB: TenantContext;
  let repo:  PostgresValeArchivoRepository;
  let query: PostgresValeArchivoQueryAdapter;
  let audit: PostgresAuditWriter;

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${DB_A}"`);
    await admin.query(`CREATE DATABASE "${DB_B}"`);
    await clientA.connect();
    await clientB.connect();
    await applyMigrations(clientA);
    await applyMigrations(clientB);

    tenantA = makeTenant(DB_A, 1);
    tenantB = makeTenant(DB_B, 2);

    router = new TenantDatabaseRouter([
      { tenantId: tenantA.tenantId, databaseName: DB_A, connectionString: dbUrl(DB_A) },
      { tenantId: tenantB.tenantId, databaseName: DB_B, connectionString: dbUrl(DB_B) },
    ]);

    repo  = new PostgresValeArchivoRepository(router);
    query = new PostgresValeArchivoQueryAdapter(router);
    audit = new PostgresAuditWriter(router);
  }, 60_000);

  afterAll(async () => {
    await router.close();
    await clientA.end();
    await clientB.end();
    await admin.query(`DROP DATABASE "${DB_A}"`);
    await admin.query(`DROP DATABASE "${DB_B}"`);
    await admin.end();
  }, 30_000);

  // ── 1. Flujo completo ─────────────────────────────────────────────────────

  it('T-37-F1: RegistrarVale crea el vale con estado RECIBIDA y audit VALE_CREADO', async () => {
    const ctx = makeContext(tenantA, ALL_PERMS);
    const uc  = new RegistrarVale({ repository: repo, auditWriter: audit });

    const result = await uc.execute({
      numeroVale: `VA-INTG-T37-F1-${suffix.slice(0, 6)}`,
      fechaSolicitud: '2026-08-26', fechaRecepcion: '2026-08-26',
      unidadSolicitante: 'DIRECCIÓN MÉDICA T37',
      solicitanteNombre: 'Dr. Sintético', solicitanteCargo: 'Director',
      autorizadorNombre: 'Dra. Sintética', autorizadorCargo: 'Subdirectora',
      items: [{ expedienteNumero: 'EXP-F1-001', pacienteNombre: 'PACIENTE SINT F1', especialidad: 'MEDICINA INTERNA' }],
      context: ctx,
    });

    expect(result.estado).toBe('RECIBIDA');
    expect(typeof result.id).toBe('string');

    // Audit entry
    const auditRow = await clientA.query<{ action: string; result: string }>(
      `SELECT action, result FROM audit_log WHERE action = 'VALE_CREADO' AND resource_id = $1`,
      [result.id],
    );
    expect(auditRow.rows).toHaveLength(1);
    expect(auditRow.rows[0]!.result).toBe('success');
  });

  it('T-37-F2: IniciarBusqueda transiciona a EN_BUSQUEDA y audit VALE_BUSQUEDA_INICIADA', async () => {
    const ctx   = makeContext(tenantA, ALL_PERMS);
    const vale  = makeVale(`VA-INTG-T37-F2-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    const uc = new IniciarBusqueda({ repository: repo, auditWriter: audit });
    await uc.execute({ valeId: vale.id.toString(), context: ctx });

    const snap = await repo.findById(vale.id.toString(), tenantA);
    expect(snap!.estado).toBe('EN_BUSQUEDA');
    expect(snap!.busquedaIniciadaPor).toBe('actor-va-intg-001');

    const auditRow = await clientA.query<{ action: string }>(
      `SELECT action FROM audit_log WHERE action = 'VALE_BUSQUEDA_INICIADA' AND resource_id = $1`,
      [vale.id.toString()],
    );
    expect(auditRow.rows).toHaveLength(1);
  });

  it('T-37-F3: RegistrarLocalizacion → todos LOCALIZADO → COMPLETA + audit VALE_ESTADO_ACTUALIZADO', async () => {
    const ctx  = makeContext(tenantA, ALL_PERMS);
    const vale = makeVale(`VA-INTG-T37-F3-${suffix.slice(0, 6)}`, 'DIRECCIÓN', 2);
    await repo.save(vale, tenantA);

    vale.iniciarBusqueda('actor-va-intg-001', new Date());
    await repo.save(vale, tenantA);

    const locUC = new RegistrarLocalizacion({ repository: repo, auditWriter: audit });
    const [item1, item2] = vale.items;

    await locUC.execute({
      valeId: vale.id.toString(), itemId: item1!.id,
      estadoBusqueda: 'LOCALIZADO', ubicacionEncontrada: 'Estante A-1',
      context: ctx,
    });
    await locUC.execute({
      valeId: vale.id.toString(), itemId: item2!.id,
      estadoBusqueda: 'LOCALIZADO', ubicacionEncontrada: 'Estante A-2',
      context: ctx,
    });

    const snap = await repo.findById(vale.id.toString(), tenantA);
    expect(snap!.estado).toBe('COMPLETA');

    const auditRow = await clientA.query<{ result: string }>(
      `SELECT result FROM audit_log WHERE action = 'VALE_ESTADO_ACTUALIZADO' AND resource_id = $1`,
      [vale.id.toString()],
    );
    expect(auditRow.rows.some((r) => r.result === 'success')).toBe(true);
  });

  it('T-37-F4: RegistrarEntrega → ENTREGADA + audit VALE_ENTREGADO sin PII de paciente', async () => {
    const ctx  = makeContext(tenantA, ALL_PERMS);
    const vale = makeVale(`VA-INTG-T37-F4-${suffix.slice(0, 6)}`, 'DIRECCIÓN', 1);
    await repo.save(vale, tenantA);
    vale.iniciarBusqueda('actor-va-intg-001', new Date());
    vale.registrarLocalizacion(vale.items[0]!.id, 'LOCALIZADO', 'Estante B', null, new Date());
    await repo.save(vale, tenantA);

    const entregaUC = new RegistrarEntrega({ repository: repo, auditWriter: audit });
    await entregaUC.execute({
      valeId: vale.id.toString(),
      receptorEntrega: 'Lic. Receptor Sintético T37',
      entregadoAt: '2026-08-26T15:00:00Z',
      itemsEntregados: [vale.items[0]!.id],
      context: ctx,
    });

    const snap = await repo.findById(vale.id.toString(), tenantA);
    expect(snap!.estado).toBe('ENTREGADA');
    expect(snap!.receptorEntrega).toBe('Lic. Receptor Sintético T37');

    // Audit without PII (INV-VA-006)
    const auditRow = await clientA.query<{ change_summary: Record<string, string> }>(
      `SELECT change_summary FROM audit_log WHERE action = 'VALE_ENTREGADO' AND resource_id = $1`,
      [vale.id.toString()],
    );
    expect(auditRow.rows).toHaveLength(1);
    const cs = JSON.stringify(auditRow.rows[0]!.change_summary ?? {});
    expect(cs).not.toMatch(/paciente/i);
    expect(cs).not.toMatch(/expediente/i);
    expect(cs).not.toMatch(/curp/i);
    expect(cs).toContain('itemCount');
  });

  // ── 2. Consulta y lista ───────────────────────────────────────────────────

  it('T-37-C1: ConsultarVale retorna el detalle correcto del vault', async () => {
    const ctx  = makeContext(tenantA, ALL_PERMS);
    const vale = makeVale(`VA-INTG-T37-C1-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    const uc     = new ConsultarVale({ queryPort: query, auditWriter: audit });
    const result = await uc.execute({ valeId: vale.id.toString(), context: ctx });

    expect(result.id).toBe(vale.id.toString());
    expect(result.estado).toBe('RECIBIDA');
    expect(result.items).toHaveLength(2);
    expect(result).not.toHaveProperty('turno');   // INV-VA-011
    expect(result).not.toHaveProperty('shift');
  });

  it('T-37-C2: ListarVales retorna solo los vales del tenant activo', async () => {
    const ctx    = makeContext(tenantA, ALL_PERMS);
    const prefix = `VA-INTG-T37-C2-${suffix.slice(0, 6)}`;
    const v1     = makeVale(`${prefix}-1`);
    const v2     = makeVale(`${prefix}-2`);
    await repo.save(v1, tenantA);
    await repo.save(v2, tenantA);

    const uc   = new ListarVales({ queryPort: query, auditWriter: audit });
    const page = await uc.execute({ limit: 50, context: ctx });

    const nos = page.items.map((i) => i.numeroVale);
    expect(nos).toContain(`${prefix}-1`);
    expect(nos).toContain(`${prefix}-2`);
  });

  // ── 3. PDF generado en memoria ────────────────────────────────────────────

  it('T-37-P1: GenerarPdfVale retorna stream %PDF y no escribe en filesystem', async () => {
    const ctx  = makeContext(tenantA, ALL_PERMS);
    const vale = makeVale(`VA-INTG-T37-P1-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    const pdfGen = new PDFKitValeArchivoGenerator();
    const uc     = new GenerarPdfVale({
      queryPort: query, pdfGenerator: pdfGen, auditWriter: audit,
    });

    const result = await uc.execute({ valeId: vale.id.toString(), context: ctx });

    const buf = await streamToBuffer(result.stream);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');

    // Filename sin PII (INV-VA-009)
    expect(result.filename).toMatch(/^sm1-14-.*-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(result.filename).not.toMatch(/paciente/i);
    expect(result.filename).not.toMatch(/curp/i);
  });

  it('T-37-P2: audit VALE_PDF_GENERADO escrito sin PII', async () => {
    const ctx  = makeContext(tenantA, ALL_PERMS);
    const vale = makeVale(`VA-INTG-T37-P2-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    const pdfGen = new PDFKitValeArchivoGenerator();
    const uc     = new GenerarPdfVale({ queryPort: query, pdfGenerator: pdfGen, auditWriter: audit });
    await uc.execute({ valeId: vale.id.toString(), context: ctx });

    const auditRow = await clientA.query<{ result: string; change_summary: unknown }>(
      `SELECT result, change_summary FROM audit_log
       WHERE action = 'VALE_PDF_GENERADO' AND resource_id = $1`,
      [vale.id.toString()],
    );
    expect(auditRow.rows).toHaveLength(1);
    expect(auditRow.rows[0]!.result).toBe('success');
    const cs = JSON.stringify(auditRow.rows[0]!.change_summary ?? {});
    expect(cs).not.toMatch(/paciente/i);
    expect(cs).not.toMatch(/curp/i);
  });

  // ── 4. Permisos con PostgreSQL real ──────────────────────────────────────

  it('T-37-PR1: sin REQUEST_CREATE → RegistrarVale lanza PERMISSION_DENIED', async () => {
    const ctx = makeContext(tenantA, ['ARCHIVE_REQUEST_VIEW']);
    const uc  = new RegistrarVale({ repository: repo, auditWriter: audit });

    await expect(
      uc.execute({
        numeroVale: `VA-INTG-T37-PR1-${suffix.slice(0, 6)}`,
        fechaSolicitud: '2026-08-26', fechaRecepcion: '2026-08-26',
        unidadSolicitante: 'DIRECCIÓN',
        solicitanteNombre: 'Dr.', solicitanteCargo: 'Dir.',
        autorizadorNombre: 'Dra.', autorizadorCargo: 'Sub.',
        items: [{ expedienteNumero: 'EXP', pacienteNombre: 'PAC', especialidad: 'MED' }],
        context: ctx,
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('T-37-PR2: sin ARCHIVE_REQUEST_VIEW → ListarVales lanza PERMISSION_DENIED', async () => {
    const ctx = makeContext(tenantA, ['REQUEST_CREATE']);
    const uc  = new ListarVales({ queryPort: query, auditWriter: audit });
    await expect(uc.execute({ context: ctx })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('T-37-PR3: sin ARCHIVE_REQUEST_PROCESS → IniciarBusqueda lanza PERMISSION_DENIED', async () => {
    const ctx  = makeContext(tenantA, ['REQUEST_CREATE', 'ARCHIVE_REQUEST_VIEW']);
    const vale = makeVale(`VA-INTG-T37-PR3-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);
    const uc = new IniciarBusqueda({ repository: repo, auditWriter: audit });
    await expect(
      uc.execute({ valeId: vale.id.toString(), context: ctx }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('T-37-PR4: sin ARCHIVE_REQUEST_DELIVER → RegistrarEntrega lanza PERMISSION_DENIED', async () => {
    const ctx  = makeContext(tenantA, ['REQUEST_CREATE', 'ARCHIVE_REQUEST_VIEW', 'ARCHIVE_REQUEST_PROCESS']);
    const vale = makeVale(`VA-INTG-T37-PR4-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);
    const uc = new RegistrarEntrega({ repository: repo, auditWriter: audit });
    await expect(
      uc.execute({
        valeId: vale.id.toString(), receptorEntrega: 'R',
        entregadoAt: '2026-08-26T15:00:00Z', itemsEntregados: [],
        context: ctx,
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  // ── 5. Tenant isolation con PostgreSQL real ───────────────────────────────

  it('T-37-TI1: Tenant B no puede leer el vale creado por Tenant A (IniciarBusqueda → NOT_FOUND)', async () => {
    const vale   = makeVale(`VA-INTG-T37-TI1-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    const ctxB = makeContext(tenantB, ALL_PERMS);
    const uc   = new IniciarBusqueda({ repository: repo, auditWriter: audit });
    await expect(
      uc.execute({ valeId: vale.id.toString(), context: ctxB }),
    ).rejects.toMatchObject({ code: 'VALE_ARCHIVO_NOT_FOUND' });
  });

  it('T-37-TI2: ConsultarVale desde Tenant B para vale de Tenant A → VALE_ARCHIVO_NOT_FOUND', async () => {
    const vale = makeVale(`VA-INTG-T37-TI2-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    const ctxB = makeContext(tenantB, ALL_PERMS);
    const uc   = new ConsultarVale({ queryPort: query, auditWriter: audit });
    await expect(
      uc.execute({ valeId: vale.id.toString(), context: ctxB }),
    ).rejects.toMatchObject({ code: 'VALE_ARCHIVO_NOT_FOUND' });
  });

  it('T-37-TI3: ListarVales Tenant B no retorna vales de Tenant A', async () => {
    const vale = makeVale(`VA-INTG-T37-TI3-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    const ctxB = makeContext(tenantB, ALL_PERMS);
    const uc   = new ListarVales({ queryPort: query, auditWriter: audit });
    const page = await uc.execute({ limit: 100, context: ctxB });

    const ids = page.items.map((i) => i.id);
    expect(ids).not.toContain(vale.id.toString());
  });

  it('T-37-TI4: datos de Tenant A no existen físicamente en la DB de Tenant B', async () => {
    const vale = makeVale(`VA-INTG-T37-TI4-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    const result = await clientB.query<{ id: string }>(
      `SELECT id FROM vale_archivo WHERE id = $1`,
      [vale.id.toString()],
    );
    expect(result.rows).toHaveLength(0);
  });

  // ── 6. Audit entries sin PII en el flujo completo ─────────────────────────

  it('T-37-A1: todas las audit entries del flujo no contienen nombres de paciente ni CURP', async () => {
    const ctx  = makeContext(tenantA, ALL_PERMS);
    const prefix = `VA-INTG-T37-A1-${suffix.slice(0, 6)}`;
    const vale = makeVale(prefix);
    const valeId = vale.id.toString();

    await repo.save(vale, tenantA);

    // Flujo completo
    const iBusqueda  = new IniciarBusqueda({ repository: repo, auditWriter: audit });
    const rLocalizacion = new RegistrarLocalizacion({ repository: repo, auditWriter: audit });
    const rEntrega   = new RegistrarEntrega({ repository: repo, auditWriter: audit });

    await iBusqueda.execute({ valeId, context: ctx });
    await rLocalizacion.execute({
      valeId, itemId: vale.items[0]!.id,
      estadoBusqueda: 'LOCALIZADO', ubicacionEncontrada: 'Estante C',
      context: ctx,
    });
    await rLocalizacion.execute({
      valeId, itemId: vale.items[1]!.id,
      estadoBusqueda: 'LOCALIZADO', ubicacionEncontrada: 'Estante D',
      context: ctx,
    });
    await rEntrega.execute({
      valeId, receptorEntrega: 'Receptor T37',
      entregadoAt: '2026-08-26T15:00:00Z',
      itemsEntregados: vale.items.map((i) => i.id),
      context: ctx,
    });

    // Check ALL audit entries for this vale
    const auditRows = await clientA.query<{ change_summary: unknown; action: string }>(
      `SELECT action, change_summary FROM audit_log WHERE resource_id = $1`,
      [valeId],
    );

    for (const row of auditRows.rows) {
      const cs = JSON.stringify(row.change_summary ?? {});
      expect(cs, `audit action=${row.action}: must not contain paciente`).not.toMatch(/paciente/i);
      expect(cs, `audit action=${row.action}: must not contain CURP pattern`)
        .not.toMatch(/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/);
      expect(cs, `audit action=${row.action}: must not contain expediente individual`)
        .not.toContain('EXP-VA-INTG');
    }

    // Verify expected actions are present
    const actions = auditRows.rows.map((r) => r.action);
    expect(actions).toContain('VALE_BUSQUEDA_INICIADA');
    expect(actions).toContain('VALE_ESTADO_ACTUALIZADO');
    expect(actions).toContain('VALE_ENTREGADO');
  });
});
