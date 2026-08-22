import type { RequestContext } from '@sigac/tenant';
import type { ExpedienteRepository } from '../domain/ports/ExpedienteRepository.js';
import type { AuditWriter } from '@sigac/audit';
import type { MovimientoExpedienteWriter } from './MovimientoExpedienteWriter.js';

export interface ArchiveOperationsTransaction {
  readonly expedienteRepository: ExpedienteRepository;
  readonly movimientoWriter: MovimientoExpedienteWriter;
  readonly auditWriter: AuditWriter;
  readonly operationOccurredAt: Date;
}

export interface ArchiveOperationsUnitOfWork {
  execute<T>(
    context: RequestContext,
    work: (transaction: ArchiveOperationsTransaction) => Promise<T>,
  ): Promise<T>;
}
