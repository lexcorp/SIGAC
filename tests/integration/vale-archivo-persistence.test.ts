/**
 * T-33 — Vale Archivo persistence integration tests con PostgreSQL real
 *
 * Cubre:
 *   - migration 0003 aplica correctamente
 *   - save() + findById() round-trip: Aggregate reconstituido correctamente
 *   - múltiples ítems persistidos y recuperados
 *   - re-save actualiza estado del vale y sus ítems
 *   - findPage() devuelve resultados paginados con cursor
 *   - findPage() filtra por estado, fecha, unidad
 *   - findByIdForDetail() devuelve snapshot completo
 *   - vale inexistente devuelve null
 *   - Tenant isolation: Tenant B no puede ver datos de Tenant A
 *
 * Fixtures 100% sintéticos — sin datos reales.
 * Sin turno/shift (INV-VA-011).
 */

import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ValeArchivo,
} from '../../packages/modules/vale-archivo/src/index.js';
import { NumeroVale } from '../../packages/modules/vale-archivo/src/domain/value-objects/NumeroVale.js';
import { parseSolicitanteReferencia } from '../../packages/modules/vale-archivo/src/domain/value-objects/SolicitanteReferencia.js';
import {
  PostgresValeArchivoRepository,
  PostgresValeArchivoQueryAdapter,
  TenantDatabaseRouter,
} from '../../packages/platform/database/src/index.js';
import type { RequestContext, TenantContext } from '../../packages/platform/tenant/src/index.js';

// ── Infrastructure helpers ────────────────────────────────────────────────────

const adminUrl =
  process.env.SIGAC_POSTGRES_ADMIN_URL ??
  'postgresql://sigac:sigac_dev_only@localhost:5432/postgres';

const suffix = randomUUID().replaceAll('-', '');
const DB_A = `sigac_va_int_a_${suffix}`;
const DB_B = `sigac_va_int_b_${suffix}`;

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
    for (const stmt of sql.split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.query(stmt);
    }
  }
}

// ── Tenant / context helpers ──────────────────────────────────────────────────

function makeTenant(dbName: string, n: number): TenantContext {
  return {
    tenantId:     `tenant-va-int-${n}`,
    slug:         `hospital-va-int-${n}`,
    hospitalId:   `hosp-va-int-${n}`,
    databaseName: dbName,
    timezone:     'America/Mexico_City',
  };
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

const NOW = new Date('2026-08-26T10:00:00Z');

function makeVale(
  numero: string,
  unidad = 'DIRECCIÓN MÉDICA',
  itemCount = 1,
): ValeArchivo {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    expedienteNumero: `EXP-VA-INT-${numero}-${i + 1}`,
    pacienteNombre:   `PACIENTE SINT ${numero} ${i + 1}`,
    especialidad:     'MEDICINA INTERNA',
  }));

  return ValeArchivo.create(
    {
      numeroVale:        NumeroVale.parse(numero),
      fechaSolicitud:    new Date('2026-08-26'),
      fechaRecepcion:    new Date('2026-08-26'),
      unidadSolicitante: unidad,
      solicitante:       parseSolicitanteReferencia('Dr. Sintético Int', 'Director'),
      autorizador:       parseSolicitanteReferencia('Dra. Sintética Int', 'Subdirectora'),
      items,
      creadoPor:         'actor-int-001',
    },
    NOW,
  );
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('T-33 — Vale Archivo persistence (PostgreSQL real)', () => {
  const admin  = new Client({ connectionString: adminUrl });
  const clientA = new Client({ connectionString: dbUrl(DB_A) });
  const clientB = new Client({ connectionString: dbUrl(DB_B) });

  let router: TenantDatabaseRouter;
  let tenantA: TenantContext;
  let tenantB: TenantContext;
  let repo: PostgresValeArchivoRepository;
  let query: PostgresValeArchivoQueryAdapter;

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
  }, 60_000);

  afterAll(async () => {
    await router.close();
    await clientA.end();
    await clientB.end();
    await admin.query(`DROP DATABASE "${DB_A}"`);
    await admin.query(`DROP DATABASE "${DB_B}"`);
    await admin.end();
  }, 30_000);

  // ── Migration ──────────────────────────────────────────────────────────────

  it('T-33-M1: migration crea las tablas vale_archivo y vale_archivo_items', async () => {
    const tables = await clientA.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('vale_archivo', 'vale_archivo_items')
       ORDER BY table_name`,
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual(['vale_archivo', 'vale_archivo_items']);
  });

  it('T-33-M2: tablas no tienen columna tenant_id (ADR-0034)', async () => {
    for (const tableName of ['vale_archivo', 'vale_archivo_items']) {
      const cols = await clientA.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND column_name = 'tenant_id'`,
        [tableName],
      );
      expect(cols.rows, `${tableName} should not have tenant_id`).toHaveLength(0);
    }
  });

  it('T-33-M3: índices creados correctamente', async () => {
    const idxResult = await clientA.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE tablename IN ('vale_archivo', 'vale_archivo_items')
         AND indexname LIKE 'idx_vale_archivo%'
       ORDER BY indexname`,
    );
    const names = idxResult.rows.map((r) => r.indexname);
    expect(names).toContain('idx_vale_archivo_estado');
    expect(names).toContain('idx_vale_archivo_fecha_sol');
    expect(names).toContain('idx_vale_archivo_unidad');
    expect(names).toContain('idx_vale_archivo_items_vale_id');
  });

  // ── Repository — save / findById ───────────────────────────────────────────

  it('T-33-R1: save() persiste el vale con sus ítems', async () => {
    const vale = makeVale('VA-INT-001', 'DIRECCIÓN MÉDICA', 2);
    await repo.save(vale, tenantA);

    const rows = await clientA.query<{ id: string }>(
      `SELECT id FROM vale_archivo WHERE id = $1`, [vale.id.toString()],
    );
    const items = await clientA.query<{ id: string }>(
      `SELECT id FROM vale_archivo_items WHERE vale_id = $1`, [vale.id.toString()],
    );
    expect(rows.rows).toHaveLength(1);
    expect(items.rows).toHaveLength(2);
  });

  it('T-33-R2: findById() recupera el snapshot y el Aggregate se reconstituye correctamente', async () => {
    const vale = makeVale('VA-INT-002');
    await repo.save(vale, tenantA);

    const snapshot = await repo.findById(vale.id.toString(), tenantA);
    expect(snapshot).not.toBeNull();

    const reconstituted = ValeArchivo.reconstitute(snapshot!);
    expect(reconstituted.id.toString()).toBe(vale.id.toString());
    expect(reconstituted.estado).toBe('RECIBIDA');
    expect(reconstituted.items).toHaveLength(1);
    expect(reconstituted.items[0]!.estadoBusqueda).toBe('PENDIENTE');
    expect(reconstituted.items[0]!.expedienteNumero).toBe('EXP-VA-INT-VA-INT-002-1');
  });

  it('T-33-R3: findById() retorna null para vale inexistente', async () => {
    const result = await repo.findById(randomUUID(), tenantA);
    expect(result).toBeNull();
  });

  it('T-33-R4: re-save actualiza estado del vale sin duplicar ítems', async () => {
    const vale = makeVale('VA-INT-003');
    await repo.save(vale, tenantA);

    // Transicionar y volver a guardar
    vale.iniciarBusqueda('actor-int-001', new Date());
    await repo.save(vale, tenantA);

    const snapshot = await repo.findById(vale.id.toString(), tenantA);
    expect(snapshot!.estado).toBe('EN_BUSQUEDA');
    expect(snapshot!.busquedaIniciadaPor).toBe('actor-int-001');

    // Items no se duplicaron
    const items = await clientA.query<{ id: string }>(
      `SELECT id FROM vale_archivo_items WHERE vale_id = $1`,
      [vale.id.toString()],
    );
    expect(items.rows).toHaveLength(1);
  });

  it('T-33-R5: round-trip completo RECIBIDA → EN_BUSQUEDA → localización → COMPLETA', async () => {
    const vale = makeVale('VA-INT-004');
    await repo.save(vale, tenantA);

    vale.iniciarBusqueda('actor-int-001', new Date());
    await repo.save(vale, tenantA);

    const itemId = vale.items[0]!.id;
    vale.registrarLocalizacion(itemId, 'LOCALIZADO', 'Estante A-1', null, new Date());
    await repo.save(vale, tenantA);

    const final = await repo.findById(vale.id.toString(), tenantA);
    expect(final!.estado).toBe('COMPLETA');
    expect(final!.items[0]!.estadoBusqueda).toBe('LOCALIZADO');
    expect(final!.items[0]!.ubicacionEncontrada).toBe('Estante A-1');
  });

  it('T-33-R6: múltiples ítems — todos persisten con sus datos correctos', async () => {
    const vale = makeVale('VA-INT-005', 'CARDIOLOGÍA', 3);
    await repo.save(vale, tenantA);

    const snapshot = await repo.findById(vale.id.toString(), tenantA);
    expect(snapshot!.items).toHaveLength(3);
    expect(snapshot!.items.map((i) => i.expedienteNumero).sort()).toEqual([
      'EXP-VA-INT-VA-INT-005-1',
      'EXP-VA-INT-VA-INT-005-2',
      'EXP-VA-INT-VA-INT-005-3',
    ]);
    expect(snapshot!.items.every((i) => i.estadoBusqueda === 'PENDIENTE')).toBe(true);
  });

  // ── QueryAdapter — findPage ────────────────────────────────────────────────

  it('T-33-Q1: findPage() retorna vales del tenant con itemCount correcto', async () => {
    // Crear vales en tenantA con identificadores únicos para este test
    const prefix = `VA-INT-PAGE-${suffix.slice(0, 6)}`;
    const v1 = makeVale(`${prefix}-1`, 'CIRUGÍA', 2);
    const v2 = makeVale(`${prefix}-2`, 'CARDIOLOGÍA', 1);
    await repo.save(v1, tenantA);
    await repo.save(v2, tenantA);

    const page = await query.findPage({ limit: 50 }, tenantA);
    const nos = page.items.map((i) => i.numeroVale);

    expect(nos).toContain(`${prefix}-1`);
    expect(nos).toContain(`${prefix}-2`);

    const item1 = page.items.find((i) => i.numeroVale === `${prefix}-1`);
    expect(item1!.itemCount).toBe(2);
  });

  it('T-33-Q2: findPage() filtra correctamente por estado', async () => {
    const prefix = `VA-INT-FLT-${suffix.slice(0, 6)}`;
    const v1 = makeVale(`${prefix}-REC`);
    const v2 = makeVale(`${prefix}-BUS`);
    await repo.save(v1, tenantA);
    await repo.save(v2, tenantA);

    v2.iniciarBusqueda('actor-int-001', new Date());
    await repo.save(v2, tenantA);

    const pageRec = await query.findPage({ estado: 'RECIBIDA', limit: 50 }, tenantA);
    const pageBus = await query.findPage({ estado: 'EN_BUSQUEDA', limit: 50 }, tenantA);

    const recNos = pageRec.items.map((i) => i.numeroVale);
    const busNos = pageBus.items.map((i) => i.numeroVale);

    expect(recNos).toContain(`${prefix}-REC`);
    expect(recNos).not.toContain(`${prefix}-BUS`);
    expect(busNos).toContain(`${prefix}-BUS`);
    expect(busNos).not.toContain(`${prefix}-REC`);
  });

  it('T-33-Q3: findPage() filtra por unidad (substring case-insensitive)', async () => {
    const prefix = `VA-INT-UNIDAD-${suffix.slice(0, 6)}`;
    const v1 = makeVale(`${prefix}-1`, 'CARDIOLOGÍA PEDIÁTRICA');
    const v2 = makeVale(`${prefix}-2`, 'CIRUGÍA GENERAL');
    await repo.save(v1, tenantA);
    await repo.save(v2, tenantA);

    const page = await query.findPage({ unidad: 'cardiología', limit: 50 }, tenantA);
    const nos = page.items.map((i) => i.numeroVale);

    expect(nos).toContain(`${prefix}-1`);
    expect(nos).not.toContain(`${prefix}-2`);
  });

  it('T-33-Q4: findPage() soporta paginación cursor-based', async () => {
    const prefix = `VA-INT-CURSOR-${suffix.slice(0, 6)}`;
    // Crear 5 vales para paginar
    for (let i = 1; i <= 5; i++) {
      const v = makeVale(`${prefix}-${i}`);
      await repo.save(v, tenantA);
      // Pequeña espera para asegurar created_at distintos
      await new Promise((r) => setTimeout(r, 10));
    }

    // Pedir las primeras 3
    const page1 = await query.findPage({ limit: 3 }, tenantA);
    expect(page1.items.length).toBeGreaterThanOrEqual(3);
    // Si hay más de 3 resultados totales, nextCursor debe existir
    if (page1.nextCursor !== null) {
      const page2 = await query.findPage({ cursor: page1.nextCursor, limit: 3 }, tenantA);
      // Los ids de page2 no deben repetir los de page1
      const ids1 = new Set(page1.items.map((i) => i.id));
      for (const item of page2.items) {
        expect(ids1.has(item.id)).toBe(false);
      }
    }
  });

  // ── QueryAdapter — findByIdForDetail ──────────────────────────────────────

  it('T-33-Q5: findByIdForDetail() retorna snapshot completo', async () => {
    const vale = makeVale(`VA-INT-DET-${suffix.slice(0, 6)}`, 'NEUROLOGÍA', 2);
    await repo.save(vale, tenantA);

    const snap = await query.findByIdForDetail(vale.id.toString(), tenantA);
    expect(snap).not.toBeNull();
    expect(snap!.id).toBe(vale.id.toString());
    expect(snap!.solicitante.nombre).toBe('Dr. Sintético Int');
    expect(snap!.autorizador.cargo).toBe('Subdirectora');
    expect(snap!.items).toHaveLength(2);
    // Snapshot no tiene turno/shift (INV-VA-011)
    expect(snap).not.toHaveProperty('turno');
    expect(snap).not.toHaveProperty('shift');
  });

  it('T-33-Q6: findByIdForDetail() retorna null para vale inexistente', async () => {
    const result = await query.findByIdForDetail(randomUUID(), tenantA);
    expect(result).toBeNull();
  });

  // ── Tenant isolation ──────────────────────────────────────────────────────

  it('T-33-TI1: Tenant B no puede ver vales de Tenant A (findById retorna null)', async () => {
    const vale = makeVale(`VA-INT-ISO-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    // Tenant B intenta leer el vale de Tenant A
    const result = await repo.findById(vale.id.toString(), tenantB);
    expect(result).toBeNull();
  });

  it('T-33-TI2: findPage() de Tenant B no devuelve vales de Tenant A', async () => {
    // Sembrar un vale solo en Tenant A
    const vale = makeVale(`VA-INT-ISO2-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    const pageB = await query.findPage({ limit: 100 }, tenantB);
    const ids = pageB.items.map((i) => i.id);
    expect(ids).not.toContain(vale.id.toString());
  });

  it('T-33-TI3: findByIdForDetail() de Tenant B retorna null para vale de Tenant A', async () => {
    const vale = makeVale(`VA-INT-ISO3-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    const result = await query.findByIdForDetail(vale.id.toString(), tenantB);
    expect(result).toBeNull();
  });

  it('T-33-TI4: datos de Tenant A no existen físicamente en la DB de Tenant B', async () => {
    const vale = makeVale(`VA-INT-ISO4-${suffix.slice(0, 6)}`);
    await repo.save(vale, tenantA);

    // Consulta directa a la DB de Tenant B
    const result = await clientB.query<{ id: string }>(
      `SELECT id FROM vale_archivo WHERE id = $1`,
      [vale.id.toString()],
    );
    expect(result.rows).toHaveLength(0);
  });

// ── T-BUG-VA-001: UNIQUE constraint sobre numero_vale ────────────────────────

describe('T-BUG-VA-001 — UNIQUE numero_vale (PostgreSQL real)', () => {
  it('T-BUG-01: vale con número nuevo se crea correctamente', async () => {
    const vale = makeVale(`VA-UNIQ-A-${suffix.slice(0, 6)}`);
    await expect(repo.save(vale, tenantA)).resolves.not.toThrow();
    const snap = await repo.findById(vale.id.toString(), tenantA);
    expect(snap).not.toBeNull();
  });

  it('T-BUG-02: insertar mismo numero_vale dos veces → segundo insert rechazado', async () => {
    const numero = `VA-DUP-${suffix.slice(0, 6)}`;
    const vale1 = makeVale(numero);
    const vale2 = makeVale(numero); // same number, different UUID
    await repo.save(vale1, tenantA);
    // Second save must throw ValeNumeroDuplicadoError (from constraint)
    await expect(repo.save(vale2, tenantA)).rejects.toMatchObject({
      name: 'ValeNumeroDuplicadoError',
    });
  });

  it('T-BUG-03: el segundo vale NO se persiste después del conflicto', async () => {
    const numero = `VA-DUP2-${suffix.slice(0, 6)}`;
    const vale1 = makeVale(numero);
    const vale2 = makeVale(numero);
    await repo.save(vale1, tenantA);
    await repo.save(vale2, tenantA).catch(() => undefined);

    // Only vale1 exists
    const rows = await clientA.query<{ id: string }>(
      `SELECT id FROM vale_archivo WHERE numero_vale = $1`, [numero],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]!.id).toBe(vale1.id.toString());
  });

  it('T-BUG-04: dos tenants distintos pueden usar el mismo numero_vale sin conflicto', async () => {
    const numero = `VA-CROSS-${suffix.slice(0, 6)}`;
    const valeA = makeVale(numero);
    const valeB = makeVale(numero);
    // Both are in different databases — no constraint collision
    await expect(repo.save(valeA, tenantA)).resolves.not.toThrow();
    await expect(repo.save(valeB, tenantB)).resolves.not.toThrow();
  });

  it('T-BUG-05: existsByNumeroVale retorna false para número nuevo', async () => {
    const exists = await repo.existsByNumeroVale('VA-NONEXISTENT', tenantA);
    expect(exists).toBe(false);
  });

  it('T-BUG-06: existsByNumeroVale retorna true después de save', async () => {
    const numero = `VA-EXISTS-${suffix.slice(0, 6)}`;
    const vale = makeVale(numero);
    await repo.save(vale, tenantA);
    const exists = await repo.existsByNumeroVale(numero, tenantA);
    expect(exists).toBe(true);
  });

  it('T-BUG-07: existsByNumeroVale de Tenant A retorna false en Tenant B (isolation)', async () => {
    const numero = `VA-ISO-${suffix.slice(0, 6)}`;
    const vale = makeVale(numero);
    await repo.save(vale, tenantA);
    // Tenant B does not see Tenant A data
    const existsInB = await repo.existsByNumeroVale(numero, tenantB);
    expect(existsInB).toBe(false);
  });
});

});
