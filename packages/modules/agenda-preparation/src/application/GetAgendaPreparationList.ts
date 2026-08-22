import type { AuditResult, AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { AgendaFecha } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import type {
  PreparationOrder,
  PreparationPagination,
  PreparationPage,
  PreparationListQueryPort,
} from './ports/ReadQueryPorts.js';

export interface GetAgendaPreparationListInput {
  readonly agendaDate: AgendaFecha;
  readonly order: PreparationOrder;
  readonly pagination: PreparationPagination;
  readonly context: RequestContext;
}

export interface GetAgendaPreparationListDependencies {
  readonly preparationQuery: PreparationListQueryPort;
  readonly auditWriter: AuditWriter;
}

export class GetAgendaPreparationList {
  constructor(private readonly deps: GetAgendaPreparationListDependencies) {}

  async execute(input: GetAgendaPreparationListInput): Promise<PreparationPage> {
    const { agendaDate, order, pagination, context } = input;
    const { tenant, actor } = context;

    if (!actor.permissions.has('AGENDA_VIEW')) {
      await this.audit(agendaDate.value, 'denied', context);
      throw new ApplicationError('PERMISSION_DENIED', 'El actor no tiene el permiso AGENDA_VIEW.');
    }

    const page = await this.deps.preparationQuery.findPage(agendaDate, order, pagination, tenant);
    await this.audit(agendaDate.value, 'success', context);
    return page;
  }

  private audit(resourceId: string, result: AuditResult, context: RequestContext): Promise<void> {
    return this.deps.auditWriter.append(
      { action: 'AGENDA_PREPARATION_VIEW', resourceType: 'AGENDA', resourceId, result },
      context,
    );
  }
}
