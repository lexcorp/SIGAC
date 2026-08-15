import type {
  ArchiveOperationsUnitOfWork,
  ArchiveOperationsTransaction,
} from '@sigac/archive-operations';
import type { RequestContext } from '@sigac/tenant';
import { PostgresAuditWriter } from '../audit/PostgresAuditWriter.js';
import type { TenantDatabaseRouter } from '../TenantDatabaseRouter.js';
import { PostgresExpedienteRepository } from './PostgresExpedienteRepository.js';
import { PostgresMovimientoExpedienteWriter } from './PostgresMovimientoExpedienteWriter.js';

export class PostgresArchiveOperationsUnitOfWork implements ArchiveOperationsUnitOfWork {
  constructor(
    private readonly router: TenantDatabaseRouter,
    private readonly auditSecurityContext: Readonly<Record<string, unknown>> | null = null,
  ) {}

  execute<T>(
    context: RequestContext,
    work: (transaction: ArchiveOperationsTransaction) => Promise<T>,
  ): Promise<T> {
    return this.router.withTransaction(context.tenant, async (session) => {
      const operationOccurredAt = new Date();
      return work({
        expedienteRepository: new PostgresExpedienteRepository(this.router, session),
        movimientoWriter: new PostgresMovimientoExpedienteWriter(this.router, session),
        auditWriter: new PostgresAuditWriter(this.router, session, this.auditSecurityContext),
        operationOccurredAt,
      });
    });
  }
}
