import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import {
  AcceptCustody,
  ApplicationError,
  DispatchExpediente,
  ExpedienteId,
  ExpedienteNumero,
  SearchExpedientesByNumero,
  Ubicacion,
} from '../../packages/modules/archive-operations/src/index.js';
import {
  PostgresArchiveOperationsUnitOfWork,
  PostgresAuditWriter,
  PostgresExpedienteRepository,
  PostgresExpedienteAuditQueryPort,
  PostgresExpedienteTimelineQueryPort,
  PostgresMovimientoExpedienteWriter,
  PostgresUbicacionesQueryPort,
  TenantDatabaseRouter,
  TenantDatabaseRoutingError,
} from '../../packages/platform/database/src/index.js';
import type { RequestContext, TenantContext } from '../../packages/platform/tenant/src/index.js';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const adminUrl = process.env.SIGAC_POSTGRES_ADMIN_URL ??
  'postgresql://sigac:sigac_dev_only@localhost:5432/postgres';
const suffix = randomUUID().replaceAll('-', '');
const databaseNames = [`sigac_t09_a_${suffix}`, `sigac_t09_b_${suffix}`] as const;
const locationA = '10000000-0000-4000-8000-000000000001';
const locationB = '10000000-0000-4000-8000-000000000002';
const expedienteA = '20000000-0000-4000-8000-000000000001';
const expedienteB = '20000000-0000-4000-8000-000000000002';
const duplicateA = '20000000-0000-4000-8000-000000000003';

function databaseUrl(name: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

function tenant(index: 0 | 1): TenantContext {
  return {
    tenantId: `tenant-${index + 1}`,
    slug: `hospital-${index + 1}`,
    hospitalId: `hospital-${index + 1}`,
    databaseName: databaseNames[index],
    timezone: 'America/Mexico_City',
  };
}

function context(index: 0 | 1, permissions: readonly string[]): RequestContext {
  return {
    tenant: tenant(index),
    actor: {
      actorId: `actor-${index + 1}`,
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(permissions),
      tenantIds: new Set([`tenant-${index + 1}`]),
    },
    requestId: `request-${index + 1}`,
    correlationId: `correlation-${index + 1}`,
    source: 'WEB',
  };
}

async function applyMigrations(client: Client): Promise<void> {
  const directory = new URL('../../migrations/tenant/', import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, directory), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await client.query(statement);
    }
  }
}

async function seed(client: Client, id: string, state: string, duplicate = false): Promise<void> {
  await client.query(
    `INSERT INTO expedientes (
      id, expediente_numero, expediente_numero_normalizado,
      paciente_id_institucional, paciente_curp, paciente_nombre_operativo,
      paciente_numero_issste, estado_operativo, ubicacion_actual_id,
      custodio_tipo, custodio_ref, custodio_servicio, custodio_location,
      custodio_accepted_at, row_version
    ) VALUES ($1, 'PERR810604/10', 'PERR81060410', 'INST-1', 'CURP-1',
      'OPERATIVO', 'ISSSTE-1', $2, $3, $4, $5, NULL, NULL, NULL, 0)`,
    [id, state, locationA, state === 'EN_TRASLADO' ? 'SERVICIO' : null,
      state === 'EN_TRASLADO' ? 'receptor-previsto' : null],
  );
  if (duplicate) await seed(client, duplicateA, state, false);
}

describe('T-09 PostgreSQL tenant infrastructure', () => {
  const admin = new Client({ connectionString: adminUrl });
  const clients = databaseNames.map((name) => new Client({ connectionString: databaseUrl(name) }));
  const router = new TenantDatabaseRouter([
    { tenantId: 'tenant-1', databaseName: databaseNames[0], connectionString: databaseUrl(databaseNames[0]) },
    { tenantId: 'tenant-2', databaseName: databaseNames[1], connectionString: databaseUrl(databaseNames[1]) },
  ]);

  beforeAll(async () => {
    await admin.connect();
    for (const databaseName of databaseNames) await admin.query(`CREATE DATABASE "${databaseName}"`);
    for (const client of clients) {
      await client.connect();
      await applyMigrations(client);
      await client.query(
        `INSERT INTO ubicaciones (id, codigo, descripcion) VALUES
          ($1, 'ARCHIVO', 'Archivo clínico'), ($2, 'CONS-1', 'Consultorio uno')`,
        [locationA, locationB],
      );
    }
    await seed(clients[0]!, expedienteA, 'APARTADO', true);
    await seed(clients[1]!, expedienteB, 'APARTADO');
  });

  afterAll(async () => {
    await router.close();
    for (const client of clients) await client.end();
    for (const databaseName of databaseNames) await admin.query(`DROP DATABASE "${databaseName}"`);
    await admin.end();
  });

  it('aplica secuencialmente audit_log con el DDL canónico', async () => {
    const columns = await clients[0]!.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_log' ORDER BY ordinal_position`,
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      'id', 'actor_ref', 'action', 'resource_type', 'resource_id', 'result',
      'request_id', 'correlation_id', 'source', 'occurred_at', 'change_summary', 'security_context',
    ]);
    const indexes = await clients[0]!.query(`SELECT indexname FROM pg_indexes WHERE tablename='audit_log'`);
    expect(indexes.rows).toHaveLength(1);
    expect(columns.rows.some((row) => ['tenant_id', 'source_ip_hash', 'created_at'].includes(row.column_name)))
      .toBe(false);
    const foreignKeys = await clients[0]!.query(
      `SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_name='audit_log' AND constraint_type='FOREIGN KEY'`,
    );
    expect(foreignKeys.rows).toEqual([]);
    await expect(clients[0]!.query(
      `INSERT INTO audit_log (id, actor_ref, action, resource_type, resource_id, result,
       request_id, correlation_id, source, occurred_at)
       VALUES ($1, 'a', 'A', 'R', '1', 'unknown', 'r', 'c', 'WEB', now())`, [randomUUID()],
    )).rejects.toMatchObject({ code: '23514' });
    await expect(clients[0]!.query(
      `INSERT INTO audit_log (id, actor_ref, action, resource_type, resource_id, result,
       request_id, correlation_id, source, occurred_at)
       VALUES ($1, 'a', 'A', 'R', '1', 'success', 'r', 'c', 'MOBILE', now())`, [randomUUID()],
    )).rejects.toMatchObject({ code: '23514' });
  });

  it('enruta por allow-list y no permite cambiar databaseName', async () => {
    await expect(router.withClient({ ...tenant(0), databaseName: databaseNames[1] }, async () => null))
      .rejects.toBeInstanceOf(TenantDatabaseRoutingError);
    const countA = await router.withClient(tenant(0), ({ client }) => client.query(`SELECT count(*) FROM expedientes`));
    const countB = await router.withClient(tenant(1), ({ client }) => client.query(`SELECT count(*) FROM expedientes`));
    expect(Number(countA.rows[0].count)).toBe(2);
    expect(Number(countB.rows[0].count)).toBe(1);
  });

  it('rehidrata VO, hospital del tenant, bigint y búsquedas 0/1/N sin cruce tenant', async () => {
    const repository = new PostgresExpedienteRepository(router);
    const found = await repository.findById(ExpedienteId.parse(expedienteA), tenant(0));
    expect(found?.snapshot()).toMatchObject({ hospitalId: 'hospital-1', rowVersion: 0n });
    expect(found?.snapshot().ubicacionActual?.descripcion).toBe('Archivo clínico');
    expect(found?.snapshot().custodiaActual).toBeNull();
    await expect(repository.findById(ExpedienteId.parse(expedienteA), tenant(1))).resolves.toBeNull();
    for (const numero of ['PERR810604/10', 'PERR810604-10', 'PERR81060410']) {
      await expect(repository.findByNumero(ExpedienteNumero.parse(numero), tenant(0)))
        .resolves.toHaveLength(2);
    }
    await expect(repository.findByNumero(ExpedienteNumero.parse('PERR81060410'), tenant(1)))
      .resolves.toHaveLength(1);
    await expect(repository.findByNumero(ExpedienteNumero.parse('ABCD123456/20'), tenant(0)))
      .resolves.toEqual([]);
  });

  it('aplica optimistic locking en save', async () => {
    const repository = new PostgresExpedienteRepository(router);
    const aggregate = await repository.findById(ExpedienteId.parse(expedienteA), tenant(0));
    aggregate!.dispatch({
      destination: Ubicacion.create({ id: locationB, codigo: 'CONS-1', descripcion: 'Consultorio uno' }),
      intendedCustodian: { type: 'SERVICIO', reference: 'receptor-1' },
      businessReference: { type: 'VALE', id: null }, occurredAt: new Date(),
    });
    await clients[0]!.query(`UPDATE expedientes SET row_version = 7 WHERE id = $1`, [expedienteA]);
    await expect(repository.save(aggregate!, tenant(0))).rejects.toMatchObject({
      code: 'OPTIMISTIC_LOCK_CONFLICT',
    });
    await clients[0]!.query(`UPDATE expedientes SET row_version = 0 WHERE id = $1`, [expedienteA]);
  });

  it('persiste movimiento y pagina timeline por cursor determinista', async () => {
    const writer = new PostgresMovimientoExpedienteWriter(router);
    const id = ExpedienteId.parse(expedienteA);
    for (const occurredAt of [new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T00:00:00Z')]) {
      await writer.append({
        expedienteId: id, movementType: 'DISPATCHED', originLocation: locationA,
        destinationLocation: locationB, originCustodianRef: null,
        destinationCustodianRef: 'receptor-1', businessReferenceType: 'VALE',
        businessReferenceId: 'ref-text', occurredAt, actorRef: 'actor-1',
        source: 'WEB', correlationId: 'correlation-1',
      }, tenant(0));
    }
    const timeline = new PostgresExpedienteTimelineQueryPort(router);
    const first = await timeline.findByExpediente(id, { limit: 1 }, tenant(0));
    const second = await timeline.findByExpediente(id, { limit: 1, cursor: first.nextCursor! }, tenant(0));
    expect(first.items[0]).toMatchObject({ destinationLocation: locationB, businessReferenceId: 'ref-text' });
    expect(first.items[0]!.occurredAt.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    expect(first.nextCursor).not.toBeNull();
    expect(second.items).toHaveLength(1);
    expect(second.items[0]!.movimientoId).not.toBe(first.items[0]!.movimientoId);
  });

  it('escribe audit standalone y enriquece desde RequestContext', async () => {
    const writer = new PostgresAuditWriter(router, undefined, { assurance: 'server-validated' });
    await writer.append({
      action: 'EXPEDIENTE_VIEW', resourceType: 'EXPEDIENTE', resourceId: expedienteA,
      result: 'success', changeSummary: { field: 'estado' },
    }, context(0, ['EXPEDIENT_VIEW']));
    const result = await clients[0]!.query(`SELECT * FROM audit_log WHERE action='EXPEDIENTE_VIEW'`);
    expect(result.rows[0]).toMatchObject({
      actor_ref: 'actor-1', request_id: 'request-1', correlation_id: 'correlation-1',
      source: 'WEB', change_summary: { field: 'estado' },
      security_context: { assurance: 'server-validated' },
    });
  });

  it('persiste los identifiers de lectura y mantiene Timeline separado de audit', async () => {
    const writer = new PostgresAuditWriter(router);
    for (const [action, resourceId] of [
      ['EXPEDIENTE_VIEW', expedienteA],
      ['EXPEDIENTE_TIMELINE_VIEW', expedienteA],
    ] as const) {
      await writer.append({ action, resourceType: 'EXPEDIENTE', resourceId, result: 'success' }, context(0, ['EXPEDIENT_VIEW']));
    }
    const audit = await clients[0]!.query(
      `SELECT DISTINCT action, resource_type, resource_id, result FROM audit_log
       WHERE action IN ('EXPEDIENTE_VIEW', 'EXPEDIENTE_TIMELINE_VIEW') ORDER BY action`,
    );
    expect(audit.rows).toEqual([
      { action: 'EXPEDIENTE_TIMELINE_VIEW', resource_type: 'EXPEDIENTE', resource_id: expedienteA, result: 'success' },
      { action: 'EXPEDIENTE_VIEW', resource_type: 'EXPEDIENTE', resource_id: expedienteA, result: 'success' },
    ]);
    const timeline = await new PostgresExpedienteTimelineQueryPort(router).findByExpediente(
      ExpedienteId.parse(expedienteA), { limit: 25 }, tenant(0),
    );
    expect(timeline.items.every((item) => !item.movementType.includes('VIEW'))).toBe(true);
  });

  it('audita Search success para 0 y N sin datos de resultados ni C3', async () => {
    const useCase = new SearchExpedientesByNumero({
      expedienteRepository: new PostgresExpedienteRepository(router),
      auditWriter: new PostgresAuditWriter(router),
    });
    await expect(useCase.execute({
      numero: ExpedienteNumero.parse('ABCD123456/20'),
      context: context(0, ['EXPEDIENT_VIEW']),
    })).resolves.toEqual([]);
    await expect(useCase.execute({
      numero: ExpedienteNumero.parse('PERR810604/10'),
      context: context(0, ['EXPEDIENT_VIEW']),
    })).resolves.toHaveLength(2);
    const rows = await clients[0]!.query(
      `SELECT action, resource_id, result, change_summary FROM audit_log
       WHERE action='EXPEDIENTE_SEARCH' ORDER BY resource_id`,
    );
    expect(rows.rows).toEqual([
      { action: 'EXPEDIENTE_SEARCH', resource_id: 'ABCD12345620', result: 'success', change_summary: null },
      { action: 'EXPEDIENTE_SEARCH', resource_id: 'PERR81060410', result: 'success', change_summary: null },
    ]);
    expect(JSON.stringify(rows.rows)).not.toMatch(/OPERATIVO|CURP-1|ISSSTE-1|patient|paciente/i);
  });

  it('confirma Dispatch aggregate + Movimiento + audit en una sola transacción', async () => {
    const useCase = new DispatchExpediente({
      unitOfWork: new PostgresArchiveOperationsUnitOfWork(router),
      auditWriter: new PostgresAuditWriter(router),
    });
    await useCase.execute({
      expedienteId: ExpedienteId.parse(expedienteA),
      destination: Ubicacion.create({ id: locationB, codigo: 'CONS-1', descripcion: 'Consultorio uno' }),
      intendedCustodian: { type: 'SERVICIO', reference: 'receptor-1' },
      businessReference: { type: 'VALE', id: 'vale-1' }, expectedRowVersion: 0n,
      context: context(0, ['EXPEDIENT_DISPATCH']),
    });
    const state = await clients[0]!.query(`SELECT estado_operativo, row_version, custodio_ref,
      custodio_servicio, custodio_location, custodio_accepted_at FROM expedientes WHERE id=$1`, [expedienteA]);
    const movement = await clients[0]!.query(`SELECT occurred_at FROM movimientos_expediente WHERE expediente_id=$1 AND movement_type='DISPATCHED' ORDER BY recorded_at DESC LIMIT 1`, [expedienteA]);
    const audit = await clients[0]!.query(`SELECT result FROM audit_log WHERE action='EXPEDIENTE_DISPATCH'`);
    expect(state.rows[0]).toMatchObject({
      estado_operativo: 'EN_TRASLADO', row_version: '1', custodio_ref: 'receptor-1',
      custodio_servicio: null, custodio_location: null, custodio_accepted_at: null,
    });
    expect(movement.rows).toHaveLength(1);
    expect(audit.rows).toContainEqual({ result: 'success' });
  });

  it('hace rollback total cuando falla movimiento o audit dentro de la UoW', async () => {
    const id = ExpedienteId.parse(duplicateA);
    const uow = new PostgresArchiveOperationsUnitOfWork(router);
    await expect(uow.execute(context(0, []), async (tx) => {
      const aggregate = await tx.expedienteRepository.findById(id, tenant(0));
      aggregate!.dispatch({
        destination: Ubicacion.create({ id: locationB, codigo: 'CONS-1', descripcion: 'Consultorio uno' }),
        intendedCustodian: { type: 'SERVICIO', reference: 'receptor-x' },
        businessReference: { type: 'VALE', id: null }, occurredAt: tx.operationOccurredAt,
      });
      await tx.expedienteRepository.save(aggregate!, tenant(0));
      await tx.movimientoWriter.append({
        expedienteId: id, movementType: 'DISPATCHED', originLocation: locationA,
        destinationLocation: 'not-a-uuid', originCustodianRef: null,
        destinationCustodianRef: 'receptor-x', businessReferenceType: 'VALE',
        businessReferenceId: null, occurredAt: tx.operationOccurredAt,
        actorRef: 'actor-1', source: 'WEB', correlationId: 'correlation-1',
      }, tenant(0));
    })).rejects.toThrow();
    const persisted = await clients[0]!.query(`SELECT estado_operativo, row_version FROM expedientes WHERE id=$1`, [duplicateA]);
    expect(persisted.rows[0]).toMatchObject({ estado_operativo: 'APARTADO', row_version: '0' });

    const useCase = new DispatchExpediente({
      unitOfWork: new PostgresArchiveOperationsUnitOfWork(router, { unsupported: 1n }),
      auditWriter: new PostgresAuditWriter(router),
    });
    await expect(useCase.execute({
      expedienteId: id,
      destination: Ubicacion.create({ id: locationB, codigo: 'CONS-1', descripcion: 'Consultorio uno' }),
      intendedCustodian: { type: 'SERVICIO', reference: 'receptor-x' },
      businessReference: { type: 'VALE', id: null }, expectedRowVersion: 0n,
      context: context(0, ['EXPEDIENT_DISPATCH']),
    })).rejects.toThrow();
    const afterAuditFailure = await clients[0]!.query(
      `SELECT estado_operativo, row_version FROM expedientes WHERE id=$1`, [duplicateA],
    );
    const movements = await clients[0]!.query(
      `SELECT count(*) FROM movimientos_expediente WHERE expediente_id=$1`, [duplicateA],
    );
    expect(afterAuditFailure.rows[0]).toMatchObject({ estado_operativo: 'APARTADO', row_version: '0' });
    expect(movements.rows[0].count).toBe('0');
  });

  it('acepta custodia atómicamente usando el mismo patrón transaccional', async () => {
    const useCase = new AcceptCustody({
      unitOfWork: new PostgresArchiveOperationsUnitOfWork(router),
      auditWriter: new PostgresAuditWriter(router),
    });
    await useCase.execute({
      expedienteId: ExpedienteId.parse(expedienteA),
      receptor: { type: 'MEDICO', reference: 'receptor-efectivo', service: 'CONSULTA' },
      ubicacionDestino: Ubicacion.create({ id: locationB, codigo: 'CONS-1', descripcion: 'Consultorio uno' }),
      businessReference: { type: 'VALE', id: 'vale-1' }, expectedRowVersion: 1n,
      context: context(0, ['CUSTODY_ACCEPT']),
    });
    const state = await clients[0]!.query(`SELECT estado_operativo, custodio_ref, custodio_location, row_version FROM expedientes WHERE id=$1`, [expedienteA]);
    const audit = await clients[0]!.query(`SELECT result FROM audit_log WHERE action='CUSTODY_ACCEPTED'`);
    expect(state.rows[0]).toMatchObject({
      estado_operativo: 'EN_CONSULTA', custodio_ref: 'receptor-efectivo',
      custodio_location: locationB, row_version: '2',
    });
    expect(audit.rows).toContainEqual({ result: 'success' });
  });

  it('audita fallos fuera de la UoW en una transacción tenant-local independiente', async () => {
    const useCase = new DispatchExpediente({
      unitOfWork: new PostgresArchiveOperationsUnitOfWork(router),
      auditWriter: new PostgresAuditWriter(router),
    });
    await expect(useCase.execute({
      expedienteId: ExpedienteId.parse(expedienteB),
      destination: Ubicacion.create({ id: locationB, codigo: 'CONS-1', descripcion: 'Consultorio uno' }),
      intendedCustodian: { type: 'SERVICIO', reference: 'r' },
      businessReference: { type: 'VALE', id: null }, expectedRowVersion: 0n,
      context: context(0, []),
    })).rejects.toBeInstanceOf(ApplicationError);
    const audit = await clients[0]!.query(`SELECT result FROM audit_log WHERE resource_id=$1`, [expedienteB]);
    expect(audit.rows).toContainEqual({ result: 'denied' });
    const otherTenantAudit = await clients[1]!.query(`SELECT count(*) FROM audit_log`);
    expect(otherTenantAudit.rows[0].count).toBe('0');
  });

  it('persiste exclusivamente los cinco AuditResult canónicos', async () => {
    const writer = new PostgresAuditWriter(router);
    for (const result of ['not-found', 'conflict', 'invalid-transition'] as const) {
      await writer.append({
        action: 'EXPEDIENTE_DISPATCH', resourceType: 'EXPEDIENTE',
        resourceId: duplicateA, result,
      }, context(0, ['EXPEDIENT_DISPATCH']));
    }
    const persisted = await clients[0]!.query<{ result: string }>(
      `SELECT DISTINCT result FROM audit_log ORDER BY result`,
    );
    expect(persisted.rows.map((row) => row.result)).toEqual([
      'conflict', 'denied', 'invalid-transition', 'not-found', 'success',
    ]);
  });

  it('consulta Audit por expediente/tenant con orden y cursor deterministas y read model sanitizado', async () => {
    const occurredAt = '2026-08-15T12:00:00.000Z';
    const auditResource = '20000000-0000-4000-8000-000000000099';
    const auditIds = ['f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001'];
    for (const [index, auditId] of auditIds.entries()) {
      await clients[0]!.query(
        `INSERT INTO audit_log (id, actor_ref, action, resource_type, resource_id, result,
          request_id, correlation_id, source, occurred_at, change_summary, security_context)
         VALUES ($1, 'actor-audit', $2, 'EXPEDIENTE', $3, 'success', 'request-audit',
          'correlation-audit', 'WEB', $4, '{"hidden":"value"}', '{"hidden":"value"}')`,
        [auditId, `AUDIT_${index}`, auditResource, occurredAt],
      );
    }
    await clients[0]!.query(
      `INSERT INTO audit_log (id, actor_ref, action, resource_type, resource_id, result,
       request_id, correlation_id, source, occurred_at)
       VALUES ($1, 'actor-audit', 'OTHER_RESOURCE', 'EXPEDIENTE', $2, 'success', 'r', 'c', 'WEB', $3)`,
      ['f0000000-0000-4000-8000-000000000003', duplicateA, occurredAt],
    );
    const query = new PostgresExpedienteAuditQueryPort(router);
    const first = await query.findByExpediente(ExpedienteId.parse(auditResource), { limit: 1 }, tenant(0));
    const second = await query.findByExpediente(ExpedienteId.parse(auditResource), { limit: 1, cursor: first.nextCursor! }, tenant(0));
    expect(first.items[0]!.auditId).toBe(auditIds[0]);
    expect(second.items[0]!.auditId).toBe(auditIds[1]);
    expect(Object.keys(first.items[0]!)).toEqual(['auditId', 'action', 'result', 'actorRef', 'occurredAt', 'source', 'requestId', 'correlationId']);
    await expect(query.findByExpediente(ExpedienteId.parse(auditResource), { limit: 10 }, tenant(1)))
      .resolves.toEqual({ items: [], nextCursor: null });
  });

  it('lista ubicaciones únicamente desde la tenant database y conserva empty/N', async () => {
    const tenantOnlyLocation = '10000000-0000-4000-8000-000000000003';
    await clients[0]!.query(`INSERT INTO ubicaciones (id, codigo, descripcion) VALUES ($1, 'T1', 'Sólo tenant uno')`, [tenantOnlyLocation]);
    const query = new PostgresUbicacionesQueryPort(router);
    const tenantOne = await query.findAll(tenant(0));
    const tenantTwo = await query.findAll(tenant(1));
    expect(tenantOne).toContainEqual({ id: tenantOnlyLocation, codigo: 'T1', descripcion: 'Sólo tenant uno' });
    expect(tenantTwo).not.toContainEqual(expect.objectContaining({ id: tenantOnlyLocation }));
    await clients[1]!.query(`DELETE FROM expedientes`);
    await clients[1]!.query(`DELETE FROM ubicaciones`);
    await expect(query.findAll(tenant(1))).resolves.toEqual([]);
  });
});
