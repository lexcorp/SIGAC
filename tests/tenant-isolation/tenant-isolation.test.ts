import { ExpedienteCapabilityService } from '../../packages/modules/archive-operations/src/application/ExpedienteCapabilityService.js';
import {
  TenantDatabaseRouter,
  TenantDatabaseRoutingError,
  type TenantDatabaseSession,
} from '../../packages/platform/database/src/TenantDatabaseRouter.js';
import type { TenantContext } from '../../packages/platform/tenant/src/index.js';
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';

const tenantA: TenantContext = {
  tenantId: 'tenant-a', slug: 'hospital-a', hospitalId: 'hospital-a',
  databaseName: 'sigac_tenant_a', timezone: 'America/Mexico_City',
};
const tenantB: TenantContext = {
  tenantId: 'tenant-b', slug: 'hospital-b', hospitalId: 'hospital-b',
  databaseName: 'sigac_tenant_b', timezone: 'America/Mexico_City',
};

function createRouter() {
  return new TenantDatabaseRouter([
    { tenantId: tenantA.tenantId, databaseName: tenantA.databaseName, connectionString: 'postgresql://unused/a' },
    { tenantId: tenantB.tenantId, databaseName: tenantB.databaseName, connectionString: 'postgresql://unused/b' },
  ]);
}

describe('T-19 tenant isolation y autorización contextual', () => {
  it('rechaza databaseName falsificado antes de obtener una conexión', async () => {
    const work = vi.fn();
    await expect(createRouter().withClient({ ...tenantA, databaseName: tenantB.databaseName }, work))
      .rejects.toBeInstanceOf(TenantDatabaseRoutingError);
    expect(work).not.toHaveBeenCalled();
  });

  it('impide reutilizar un transaction handle de otro tenant', () => {
    const session = {
      tenantId: tenantA.tenantId,
      databaseName: tenantA.databaseName,
      client: {} as PoolClient,
    } satisfies TenantDatabaseSession;
    expect(() => createRouter().assertSessionTenant(session, tenantB))
      .toThrow(TenantDatabaseRoutingError);
  });

  it('no convierte roles ni capabilities en permissions', () => {
    const capabilities = new ExpedienteCapabilityService().calculate({
      estadoOperativo: 'APARTADO', solicitudActiva: null, prestamoActivo: null,
      fuentesHabilitantesSalida: [],
      actor: {
        actorId: 'actor-a', roles: new Set(['ARCHIVISTA']),
        permissions: new Set(['DISPATCH']), tenantIds: new Set([tenantA.tenantId]),
      },
      tenant: tenantA,
    });
    expect(capabilities).toEqual([]);
  });

  it('mantiene ORDEN_SUPERIOR fail-closed aunque esté validada', () => {
    const capabilities = new ExpedienteCapabilityService().calculate({
      estadoOperativo: 'DISPONIBLE', solicitudActiva: null, prestamoActivo: null,
      fuentesHabilitantesSalida: [{ tipo: 'ORDEN_SUPERIOR', validada: true }],
      actor: {
        actorId: 'actor-a', roles: new Set(['ARCHIVISTA']),
        permissions: new Set(['EXPEDIENT_VIEW', 'LOAN_OPEN']),
        tenantIds: new Set([tenantA.tenantId]),
      },
      tenant: tenantA,
    });
    expect(capabilities).not.toContain('ABRIR_PRESTAMO');
  });
});
