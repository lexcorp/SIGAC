import type { RequestContext } from '@sigac/tenant';
import type { ExpedienteRepository } from '../domain/ports/ExpedienteRepository.js';
import type { ExpedienteId } from '../domain/value-objects/ExpedienteId.js';
import { ApplicationError } from './ApplicationError.js';
import type {
  ExpedienteAuditPage,
  ExpedienteAuditPagination,
  ExpedienteAuditQueryPort,
} from './ExpedienteAuditQueryPort.js';

export interface GetExpedienteAuditInput {
  readonly expedienteId: ExpedienteId;
  readonly pagination: ExpedienteAuditPagination;
  readonly context: RequestContext;
}

export class GetExpedienteAudit {
  constructor(private readonly dependencies: {
    readonly expedienteRepository: ExpedienteRepository;
    readonly auditQuery: ExpedienteAuditQueryPort;
  }) {}

  async execute(input: GetExpedienteAuditInput): Promise<ExpedienteAuditPage> {
    if (!input.context.actor.permissions.has('EXPEDIENT_AUDIT_VIEW')) {
      throw new ApplicationError('PERMISSION_DENIED', 'El actor no puede consultar Audit.');
    }
    const expediente = await this.dependencies.expedienteRepository.findById(
      input.expedienteId,
      input.context.tenant,
    );
    if (expediente === null) {
      throw new ApplicationError('EXPEDIENTE_NOT_FOUND', 'Expediente no disponible.');
    }
    return this.dependencies.auditQuery.findByExpediente(
      input.expedienteId,
      input.pagination,
      input.context.tenant,
    );
  }
}
