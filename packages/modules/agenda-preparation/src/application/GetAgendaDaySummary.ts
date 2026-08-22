import type { AuditResult, AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { AgendaFecha } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import type { AgendaDayReadModel, AgendaDayQueryPort } from './ports/ReadQueryPorts.js';

export interface GetAgendaDaySummaryInput {
  readonly agendaDate: AgendaFecha;
  readonly context: RequestContext;
}

export interface GetAgendaDaySummaryDependencies {
  readonly dayQuery: AgendaDayQueryPort;
  readonly auditWriter: AuditWriter;
}

export class GetAgendaDaySummary {
  constructor(private readonly deps: GetAgendaDaySummaryDependencies) {}

  async execute(input: GetAgendaDaySummaryInput): Promise<AgendaDayReadModel> {
    const { agendaDate, context } = input;
    const { tenant, actor } = context;

    if (!actor.permissions.has('AGENDA_VIEW')) {
      await this.audit(agendaDate.value, 'denied', context);
      throw new ApplicationError('PERMISSION_DENIED', 'El actor no tiene el permiso AGENDA_VIEW.');
    }

    const model = await this.deps.dayQuery.findByDate(agendaDate, tenant);

    if (model === null) {
      await this.audit(agendaDate.value, 'not-found', context);
      throw new ApplicationError('AGENDA_NOT_FOUND', 'No existe Agenda para esa fecha en el tenant activo.');
    }

    await this.audit(agendaDate.value, 'success', context);
    return model;
  }

  private audit(resourceId: string, result: AuditResult, context: RequestContext): Promise<void> {
    return this.deps.auditWriter.append(
      { action: 'AGENDA_VIEW', resourceType: 'AGENDA', resourceId, result },
      context,
    );
  }
}
