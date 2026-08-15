import type { RequestContext } from '@sigac/tenant';
import type { ExpedienteRepository } from '../domain/ports/ExpedienteRepository.js';
import type { ExpedienteId } from '../domain/value-objects/ExpedienteId.js';
import { ApplicationError } from './ApplicationError.js';
import type { AuditResult, AuditWriter } from './AuditWriter.js';
import type {
  ExpedienteTimelineQueryPort,
  TimelinePage,
  TimelinePagination,
} from './ExpedienteTimelineQueryPort.js';

export interface GetExpedienteTimelineInput {
  readonly expedienteId: ExpedienteId;
  readonly pagination: TimelinePagination;
  readonly context: RequestContext;
}

export interface GetExpedienteTimelineDependencies {
  readonly expedienteRepository: ExpedienteRepository;
  readonly timelineQuery: ExpedienteTimelineQueryPort;
  readonly auditWriter: AuditWriter;
}

export class GetExpedienteTimeline {
  constructor(private readonly dependencies: GetExpedienteTimelineDependencies) {}

  async execute(input: GetExpedienteTimelineInput): Promise<TimelinePage> {
    const { expedienteId, pagination, context } = input;

    if (!context.actor.permissions.has('EXPEDIENT_VIEW')) {
      await this.audit(expedienteId, context, 'denied');
      throw new ApplicationError(
        'PERMISSION_DENIED',
        'El actor no tiene permiso para consultar el timeline del Expediente.',
      );
    }

    const expediente = await this.dependencies.expedienteRepository.findById(
      expedienteId,
      context.tenant,
    );

    if (expediente === null) {
      await this.audit(expedienteId, context, 'not-found');
      throw new ApplicationError(
        'EXPEDIENTE_NOT_FOUND',
        'El Expediente no existe en el tenant activo.',
      );
    }

    const page = await this.dependencies.timelineQuery.findByExpediente(
      expedienteId,
      pagination,
      context.tenant,
    );

    await this.audit(expedienteId, context, 'success');
    return page;
  }

  private audit(
    expedienteId: ExpedienteId,
    context: RequestContext,
    result: AuditResult,
  ): Promise<void> {
    return this.dependencies.auditWriter.append(
      {
        action: 'EXPEDIENTE_TIMELINE_VIEW',
        resourceType: 'EXPEDIENTE',
        resourceId: expedienteId.toString(),
        result,
      },
      context,
    );
  }
}
