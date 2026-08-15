import type { RequestContext } from '@sigac/tenant';
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { TenantDatabaseRouter, type TenantDatabaseSession } from '../TenantDatabaseRouter.js';
import { PostgresAuditWriter, UnsafeAuditMetadataError } from './PostgresAuditWriter.js';

const context: RequestContext = {
  actor: {
    actorId: 'actor-1', roles: new Set(['ARCHIVISTA']),
    permissions: new Set(['EXPEDIENT_VIEW']), tenantIds: new Set(['tenant-a']),
  },
  tenant: {
    tenantId: 'tenant-a', slug: 'hospital-a', hospitalId: 'hospital-a',
    databaseName: 'sigac_tenant_a', timezone: 'America/Mexico_City',
  },
  requestId: 'request-1', correlationId: 'correlation-1', source: 'WEB',
};

function setup(securityContext: Readonly<Record<string, unknown>> | null = null) {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const session = {
    tenantId: context.tenant.tenantId,
    databaseName: context.tenant.databaseName,
    client: { query } as unknown as PoolClient,
  } satisfies TenantDatabaseSession;
  const router = new TenantDatabaseRouter([{
    tenantId: context.tenant.tenantId,
    databaseName: context.tenant.databaseName,
    connectionString: 'postgresql://unused/tenant-a',
  }]);
  return { writer: new PostgresAuditWriter(router, session, securityContext), query };
}

describe('PostgresAuditWriter security contract', () => {
  it('expone únicamente append y mapea RequestContext sin tenant_id', async () => {
    const { writer, query } = setup({ assurance: 'server-validated' });
    expect(Object.getOwnPropertyNames(PostgresAuditWriter.prototype)).toEqual([
      'constructor', 'append', 'insert',
    ]);
    await writer.append({
      action: 'EXPEDIENTE_VIEW', resourceType: 'EXPEDIENTE', resourceId: 'exp-1',
      result: 'success', changeSummary: { estado: 'consultado' },
    }, context);
    const [sql, parameters] = query.mock.calls[0] as [string, readonly unknown[]];
    expect(sql).toContain('INSERT INTO audit_log');
    expect(sql).not.toMatch(/UPDATE|DELETE|UPSERT|tenant_id/i);
    expect(parameters).toEqual(expect.arrayContaining([
      context.actor.actorId, context.requestId, context.correlationId, context.source,
    ]));
  });

  it.each([
    [{ token: 'secret-value' }, null],
    [{ pacienteNombre: 'Paciente' }, null],
    [null, { connectionString: 'postgresql://secret' }],
    [null, { nested: { stackTrace: 'internal' } }],
  ] as const)('rechaza metadata sensible antes del INSERT', async (changeSummary, securityContext) => {
    const { writer, query } = setup(securityContext);
    await expect(writer.append({
      action: 'EXPEDIENTE_VIEW', resourceType: 'EXPEDIENTE', resourceId: 'exp-1',
      result: 'success', ...(changeSummary ? { changeSummary } : {}),
    }, context)).rejects.toBeInstanceOf(UnsafeAuditMetadataError);
    expect(query).not.toHaveBeenCalled();
  });
});
