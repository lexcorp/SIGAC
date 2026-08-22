import type { AuditWriter } from '@sigac/audit';
import type { TenantContext } from '@sigac/tenant';
import type { IdempotencyKeyRepository } from './IdempotencyKeyRepository.js';
import type {
  AgendaRepository,
  ImportArtifactMetadataRepository,
  ImportacionAgendaRepository,
} from './RepositoryPorts.js';

// PORT-AP-009 — Unit of Work

export interface AgendaPreparationTransaction {
  readonly importacionAgendaRepository: ImportacionAgendaRepository;
  readonly agendaRepository: AgendaRepository;
  readonly importArtifactMetadataRepository: ImportArtifactMetadataRepository;
  readonly idempotencyKeyRepository: IdempotencyKeyRepository;
  readonly auditWriter: AuditWriter;
  readonly importedAt: Date;
}

export interface AgendaPreparationUnitOfWork {
  execute<T>(
    tenant: TenantContext,
    operation: (transaction: AgendaPreparationTransaction) => Promise<T>,
  ): Promise<T>;
}
