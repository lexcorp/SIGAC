import type { AuditEntry } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { ImportacionAgendaId } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import { GetAgendaImportIncidents } from './GetAgendaImportIncidents.js';
import type { AgendaImportIncidentSummary } from './ports/ReadQueryPorts.js';

const tenant: TenantContext = {
  tenantId: 'tenant-a', slug: 'hospital-a', hospitalId: 'hosp-a',
  databaseName: 'sigac_hosp_a', timezone: 'America/Mexico_City',
};

function makeContext(permissions: string[] = ['AGENDA_INCIDENT_VIEW']): RequestContext {
  return {
    actor: { actorId: 'actor-001', roles: new Set(['ARCHIVISTA']),
      permissions: new Set(permissions), tenantIds: new Set(['tenant-a']) },
    tenant, requestId: 'req-001', correlationId: 'corr-001', source: 'WEB',
  };
}

const importacionId = ImportacionAgendaId.parse('import-001');

const sampleIncidents: AgendaImportIncidentSummary[] = [
  { incidenciaId: 'inc-001', registroId: 'reg-001', sourcePosition: 2, type: 'PHYSICIAN_NOT_RESOLVED' },
  { incidenciaId: 'inc-002', registroId: 'reg-002', sourcePosition: 4, type: 'EXPEDIENT_NOT_RESOLVED' },
];

function setup(queryResult: AgendaImportIncidentSummary[] = sampleIncidents) {
  const incidentsQuery = { findByImportacionId: vi.fn().mockResolvedValue(queryResult) };
  const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
  const useCase = new GetAgendaImportIncidents({ incidentsQuery, auditWriter });
  return { useCase, incidentsQuery, auditWriter };
}

describe('GetAgendaImportIncidents', () => {
  it('devuelve incidencias con campos exactos sin datos técnicos internos, audita success', async () => {
    const { useCase, incidentsQuery, auditWriter } = setup();
    const result = await useCase.execute({ importacionId, context: makeContext() });
    expect(result).toHaveLength(2);
    expect(result[0].incidenciaId).toBe('inc-001');
    expect(result[0].sourcePosition).toBe(2);
    expect(result[0].type).toBe('PHYSICIAN_NOT_RESOLVED');
    expect(result[0]).not.toHaveProperty('rawContent');
    expect(result[0]).not.toHaveProperty('nombrePaciente');
    expect(incidentsQuery.findByImportacionId).toHaveBeenCalledWith(importacionId, tenant);
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    const success = calls.find(([e]) => e.result === 'success');
    expect(success![0].action).toBe('AGENDA_INCIDENT_VIEW');
    expect(success![0].resourceType).toBe('AGENDA_IMPORT');
    expect(success![0].resourceId).toBe('import-001');
  });

  it('lista vacía se considera success (0 incidencias es válido)', async () => {
    const { useCase, auditWriter } = setup([]);
    const result = await useCase.execute({ importacionId, context: makeContext() });
    expect(result).toHaveLength(0);
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'success')).toBeDefined();
    expect(calls.find(([e]) => e.result === 'not-found')).toBeUndefined();
  });

  it('audita denied y lanza PERMISSION_DENIED con AGENDA_INCIDENT_VIEW ausente', async () => {
    const { useCase, incidentsQuery, auditWriter } = setup();
    await expect(useCase.execute({ importacionId, context: makeContext([]) }))
      .rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });
    expect(incidentsQuery.findByImportacionId).not.toHaveBeenCalled();
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'denied')).toBeDefined();
  });

  it('propaga el tenant correcto al query port', async () => {
    const { useCase, incidentsQuery } = setup();
    await useCase.execute({ importacionId, context: makeContext() });
    expect(incidentsQuery.findByImportacionId).toHaveBeenCalledWith(importacionId, tenant);
  });
});
