import type { UbicacionOption, UbicacionesQueryPort } from '@sigac/archive-operations';
import type { TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter } from '../TenantDatabaseRouter.js';

export class PostgresUbicacionesQueryPort implements UbicacionesQueryPort {
  constructor(private readonly router: TenantDatabaseRouter) {}

  findAll(tenant: TenantContext): Promise<readonly UbicacionOption[]> {
    return this.router.withClient(tenant, async ({ client }) => {
      const result = await client.query<UbicacionOption>('SELECT id, codigo, descripcion FROM ubicaciones');
      return result.rows.map(({ id, codigo, descripcion }) => ({ id, codigo, descripcion }));
    });
  }
}
