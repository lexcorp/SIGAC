import type { AuditResult, AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { ImportacionAgendaId } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import type { AgendaImportResult, AgendaImportResultQueryPort } from './ports/ReadQueryPorts.js';

export interface GetAgendaImportResultInput {
  readonly importacionId: ImportacionAgendaId;
  readonly context: RequestContext;
}

export interface GetAgendaImportResultDependencies {
  readonly importResultQuery: AgendaImportResultQueryPort;
  readonly auditWriter: AuditWriter;
}

export class GetAgendaImportResult {
  constructor(private readonly deps: GetAgendaImportResultDependencies) {}

  async execute(input: GetAgendaImportResultInput): Promise<AgendaImportResult> {
    const { importacionId, context } = input;
    const { tenant, actor } = context;

    if (!actor.permissions.has('AGENDA_VIEW')) {
      await this.audit(importacionId.value, 'denied', context);
      throw new ApplicationError('PERMISSION_DENIED', 'El actor no tiene el permiso AGENDA_VIEW.');
    }

    const result = await this.deps.importResultQuery.findById(importacionId, tenant);

    if (result === null) {
      await this.audit(importacionId.value, 'not-found', context);
      throw new ApplicationError('AGENDA_IMPORT_NOT_FOUND', 'La importación no existe en el tenant activo.');
    }

    await this.audit(importacionId.value, 'success', context);
    return result;
  }

  private audit(resourceId: string, result: AuditResult, context: RequestContext): Promise<void> {
    return this.deps.auditWriter.append(
      { action: 'AGENDA_VIEW', resourceType: 'AGENDA_IMPORT', resourceId, result },
      context,
    );
  }
}
