import type { TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter, TenantDatabaseSession } from '../TenantDatabaseRouter.js';

export class TenantSessionExecutor {
  constructor(
    private readonly router: TenantDatabaseRouter,
    private readonly session?: TenantDatabaseSession,
  ) {}

  execute<T>(tenant: TenantContext, work: (session: TenantDatabaseSession) => Promise<T>): Promise<T> {
    if (this.session) {
      this.router.assertSessionTenant(this.session, tenant);
      return work(this.session);
    }
    return this.router.withClient(tenant, work);
  }
}
