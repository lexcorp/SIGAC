import type { AuditResult, AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { AgendaFecha } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import type {
  PreparationOrder,
  PreparationListQueryPort,
  PreparationItem,
} from './ports/ReadQueryPorts.js';

export interface PrintAgendaPreparationListInput {
  readonly agendaDate: AgendaFecha;
  readonly order: PreparationOrder;
  readonly context: RequestContext;
}

export interface PrintAgendaPreparationListDependencies {
  readonly preparationQuery: PreparationListQueryPort;
  readonly auditWriter: AuditWriter;
}

export class PrintAgendaPreparationList {
  constructor(private readonly deps: PrintAgendaPreparationListDependencies) {}

  async execute(input: PrintAgendaPreparationListInput): Promise<readonly PreparationItem[]> {
    const { agendaDate, order, context } = input;
    const { tenant, actor } = context;

    if (!actor.permissions.has('AGENDA_VIEW')) {
      await this.audit(agendaDate.value, 'denied', context);
      throw new ApplicationError('PERMISSION_DENIED', 'El actor no tiene el permiso AGENDA_VIEW.');
    }

    const items = await this.deps.preparationQuery.listForPrint(agendaDate, order, tenant);
    await this.audit(agendaDate.value, 'success', context);
    return items;
  }

  private audit(resourceId: string, result: AuditResult, context: RequestContext): Promise<void> {
    return this.deps.auditWriter.append(
      { action: 'AGENDA_PREPARATION_VIEW', resourceType: 'AGENDA', resourceId, result },
      context,
    );
  }
}
