import type { TenantContext } from '@sigac/tenant';
import { Pool, type PoolClient, type PoolConfig } from 'pg';

export interface TenantDatabaseRegistration {
  readonly tenantId: string;
  readonly databaseName: string;
  readonly connectionString: string;
}

export interface TenantDatabaseSession {
  readonly tenantId: string;
  readonly databaseName: string;
  readonly client: PoolClient;
}

export class TenantDatabaseRoutingError extends Error {
  readonly name = 'TenantDatabaseRoutingError';
}

/** Resolves only preconfigured tenant databases from a server-side TenantContext. */
export class TenantDatabaseRouter {
  private readonly registrations = new Map<string, TenantDatabaseRegistration>();
  private readonly pools = new Map<string, Pool>();

  constructor(
    registrations: readonly TenantDatabaseRegistration[],
    private readonly poolOptions: Omit<PoolConfig, 'connectionString' | 'database'> = {},
  ) {
    for (const registration of registrations) {
      if (this.registrations.has(registration.tenantId)) {
        throw new TenantDatabaseRoutingError(`Tenant duplicado: ${registration.tenantId}`);
      }
      this.registrations.set(registration.tenantId, registration);
    }
  }

  async withClient<T>(
    tenant: TenantContext,
    work: (session: TenantDatabaseSession) => Promise<T>,
  ): Promise<T> {
    const registration = this.resolve(tenant);
    const client = await this.poolFor(registration).connect();
    try {
      return await work({
        tenantId: registration.tenantId,
        databaseName: registration.databaseName,
        client,
      });
    } finally {
      client.release();
    }
  }

  async withTransaction<T>(
    tenant: TenantContext,
    work: (session: TenantDatabaseSession) => Promise<T>,
  ): Promise<T> {
    return this.withClient(tenant, async (session) => {
      await session.client.query('BEGIN');
      try {
        const result = await work(session);
        await session.client.query('COMMIT');
        return result;
      } catch (error) {
        await session.client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async close(): Promise<void> {
    await Promise.all([...this.pools.values()].map((pool) => pool.end()));
    this.pools.clear();
  }

  assertSessionTenant(session: TenantDatabaseSession, tenant: TenantContext): void {
    const registration = this.resolve(tenant);
    if (
      session.tenantId !== registration.tenantId ||
      session.databaseName !== registration.databaseName
    ) {
      throw new TenantDatabaseRoutingError('La sesión PostgreSQL no corresponde al tenant activo.');
    }
  }

  private resolve(tenant: TenantContext): TenantDatabaseRegistration {
    const registration = this.registrations.get(tenant.tenantId);
    if (!registration || registration.databaseName !== tenant.databaseName) {
      throw new TenantDatabaseRoutingError('TenantContext no registrado o databaseName no permitido.');
    }
    return registration;
  }

  private poolFor(registration: TenantDatabaseRegistration): Pool {
    let pool = this.pools.get(registration.tenantId);
    if (!pool) {
      pool = new Pool({ ...this.poolOptions, connectionString: registration.connectionString });
      this.pools.set(registration.tenantId, pool);
    }
    return pool;
  }
}
