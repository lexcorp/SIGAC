import type { AuditResult, AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { ImportacionAgendaId } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import type { AgendaImportIncidentSummary, AgendaImportIncidentsQueryPort } from './ports/ReadQueryPorts.js';

export interface GetAgendaImportIncidentsInput {
  readonly importacionId: ImportacionAgendaId;
  readonly context: RequestContext;
}

export interface GetAgendaImportIncidentsDependencies {
  readonly incidentsQuery: AgendaImportIncidentsQueryPort;
  readonly auditWriter: AuditWriter;
}

export class GetAgendaImportIncidents {
  constructor(private readonly deps: GetAgendaImportIncidentsDependencies) {}

  async execute(input: GetAgendaImportIncidentsInput): Promise<readonly AgendaImportIncidentSummary[]> {
    const { importacionId, context } = input;
    const { tenant, actor } = context;

    if (!actor.permissions.has('AGENDA_INCIDENT_VIEW')) {
      await this.audit(importacionId.value, 'denied', context);
      throw new ApplicationError('PERMISSION_DENIED', 'El actor no tiene el permiso AGENDA_INCIDENT_VIEW.');
    }

    const incidents = await this.deps.incidentsQuery.findByImportacionId(importacionId, tenant);
    // Empty collection = success (importacion may have 0 incidents)
    await this.audit(importacionId.value, 'success', context);
    return incidents;
  }

  private audit(resourceId: string, result: AuditResult, context: RequestContext): Promise<void> {
    return this.deps.auditWriter.append(
      { action: 'AGENDA_INCIDENT_VIEW', resourceType: 'AGENDA_IMPORT', resourceId, result },
      context,
    );
  }
}
