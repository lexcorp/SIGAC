import type { AuditEntry } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { AgendaFecha } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import { GetAgendaDaySummary } from './GetAgendaDaySummary.js';
import type { AgendaDayReadModel } from './ports/ReadQueryPorts.js';

const tenant: TenantContext = {
  tenantId: 'tenant-a', slug: 'hospital-a', hospitalId: 'hosp-a',
  databaseName: 'sigac_hosp_a', timezone: 'America/Mexico_City',
};

function makeContext(permissions: string[] = ['AGENDA_VIEW']): RequestContext {
  return {
    actor: { actorId: 'actor-001', roles: new Set(['ARCHIVISTA']),
      permissions: new Set(permissions), tenantIds: new Set(['tenant-a']) },
    tenant, requestId: 'req-001', correlationId: 'corr-001', source: 'WEB',
  };
}

const agendaDate = AgendaFecha.parse('2026-08-25');

const sampleModel: AgendaDayReadModel = {
  agendaDate: '2026-08-25',
  latestImportacionId: 'imp-001',
  latestImportedAt: new Date('2026-08-25T10:00:00Z'),
  latestOutcome: 'IMPORTED',
  activeAppointments: 15,
  physicians: 3,
  services: 2,
  incidentCount: 1,
};

function setup(queryResult: AgendaDayReadModel | null = sampleModel) {
  const dayQuery = { findByDate: vi.fn().mockResolvedValue(queryResult) };
  const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
  const useCase = new GetAgendaDaySummary({ dayQuery, auditWriter });
  return { useCase, dayQuery, auditWriter };
}

describe('GetAgendaDaySummary', () => {
  it('devuelve el read model con conteos vigentes y audita success', async () => {
    const { useCase, dayQuery, auditWriter } = setup();
    const result = await useCase.execute({ agendaDate, context: makeContext() });
    expect(result.agendaDate).toBe('2026-08-25');
    expect(result.activeAppointments).toBe(15);
    expect(result.physicians).toBe(3);
    expect(result.services).toBe(2);
    expect(result.incidentCount).toBe(1);
    expect(result).not.toHaveProperty('rawContent');
    expect(dayQuery.findByDate).toHaveBeenCalledWith(agendaDate, tenant);
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    const success = calls.find(([e]) => e.result === 'success');
    expect(success![0].action).toBe('AGENDA_VIEW');
    expect(success![0].resourceType).toBe('AGENDA');
    expect(success![0].resourceId).toBe('2026-08-25');
  });

  it('audita not-found y lanza AGENDA_NOT_FOUND cuando no existe la Agenda', async () => {
    const { useCase, auditWriter } = setup(null);
    await expect(useCase.execute({ agendaDate, context: makeContext() }))
      .rejects.toMatchObject({ name: 'ApplicationError', code: 'AGENDA_NOT_FOUND' });
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'not-found')).toBeDefined();
  });

  it('audita denied y lanza PERMISSION_DENIED sin consultar datos', async () => {
    const { useCase, dayQuery, auditWriter } = setup();
    await expect(useCase.execute({ agendaDate, context: makeContext([]) }))
      .rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });
    expect(dayQuery.findByDate).not.toHaveBeenCalled();
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'denied')).toBeDefined();
  });

  it('propaga el tenant correcto al query port', async () => {
    const { useCase, dayQuery } = setup();
    await useCase.execute({ agendaDate, context: makeContext() });
    expect(dayQuery.findByDate).toHaveBeenCalledWith(agendaDate, tenant);
  });
});
