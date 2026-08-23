import type {
  AgendaPreparationTransaction,
  AgendaPreparationUnitOfWork,
} from '@sigac/agenda-preparation';
import type { TenantContext } from '@sigac/tenant';
import { PostgresAuditWriter } from '../audit/PostgresAuditWriter.js';
import type { TenantDatabaseRouter } from '../TenantDatabaseRouter.js';
import { PostgresAgendaRepository } from './PostgresAgendaRepository.js';
import { PostgresIdempotencyKeyRepository } from './PostgresIdempotencyKeyRepository.js';
import { PostgresImportArtifactMetadataRepository } from './PostgresImportArtifactMetadataRepository.js';
import { PostgresImportacionAgendaRepository } from './PostgresImportacionAgendaRepository.js';

export class PostgresAgendaPreparationUnitOfWork implements AgendaPreparationUnitOfWork {
  constructor(
    private readonly router: TenantDatabaseRouter,
    private readonly auditSecurityContext: Readonly<Record<string, unknown>> | null = null,
  ) {}

  execute<T>(
    tenant: TenantContext,
    operation: (transaction: AgendaPreparationTransaction) => Promise<T>,
  ): Promise<T> {
    return this.router.withTransaction(tenant, async (session) => {
      const importedAt = new Date();
      const transaction: AgendaPreparationTransaction = {
        importacionAgendaRepository: new PostgresImportacionAgendaRepository(this.router, session),
        agendaRepository: new PostgresAgendaRepository(this.router, session),
        importArtifactMetadataRepository: new PostgresImportArtifactMetadataRepository(
          this.router,
          session,
        ),
        idempotencyKeyRepository: new PostgresIdempotencyKeyRepository(this.router, session),
        auditWriter: new PostgresAuditWriter(this.router, session, this.auditSecurityContext),
        importedAt,
      };
      return operation(transaction);
    });
  }
}
