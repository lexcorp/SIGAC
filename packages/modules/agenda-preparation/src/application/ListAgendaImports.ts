import type { AuditResult, AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import { ApplicationError } from './ApplicationError.js';
import type { AgendaImportHistoryPage, AgendaImportHistoryQueryPort } from './ports/ReadQueryPorts.js';

export interface ListAgendaImportsInput {
  readonly agendaDate?: string;
  readonly pagination: { readonly cursor?: string; readonly limit: number };
  readonly context: RequestContext;
}

export interface ListAgendaImportsDependencies {
  readonly historyQuery: AgendaImportHistoryQueryPort;
  readonly auditWriter: AuditWriter;
}

export class ListAgendaImports {
  constructor(private readonly deps: ListAgendaImportsDependencies) {}

  async execute(input: ListAgendaImportsInput): Promise<AgendaImportHistoryPage> {
    const { context } = input;
    const { tenant, actor } = context;
    const auditResourceId = input.agendaDate ?? 'AGENDA_IMPORT_LIST';

    if (!actor.permissions.has('AGENDA_VIEW')) {
      await this.audit(auditResourceId, 'denied', context);
      throw new ApplicationError('PERMISSION_DENIED', 'El actor no tiene el permiso AGENDA_VIEW.');
    }

    const page = await this.deps.historyQuery.findAll(input.agendaDate, input.pagination, tenant);
    await this.audit(auditResourceId, 'success', context);
    return page;
  }

  private audit(resourceId: string, result: AuditResult, context: RequestContext): Promise<void> {
    return this.deps.auditWriter.append(
      { action: 'AGENDA_VIEW', resourceType: 'AGENDA_IMPORT', resourceId, result },
      context,
    );
  }
}
