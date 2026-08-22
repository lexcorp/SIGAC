import type { AuditEntry } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationError } from './ApplicationError.js';
import { ListAgendaImports } from './ListAgendaImports.js';
import type { AgendaImportHistoryPage } from './ports/ReadQueryPorts.js';

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

const emptyPage: AgendaImportHistoryPage = { items: [], nextCursor: null };
const pageWithItem: AgendaImportHistoryPage = {
  items: [{
    importacionId: 'imp-1', agendaDate: '2026-08-25',
    importedAt: new Date('2026-08-25T10:00:00Z'), outcome: 'IMPORTED',
    metrics: { receivedRecords: 1, processed: 1, added: 1, updated: 0, unchanged: 0,
      restored: 0, pendingReview: 0, rejected: 0, duplicateFolio: 0,
      withdrawnFromAgenda: 0, incidents: 0, errors: 0 },
  }],
  nextCursor: 'cursor-next',
};

function setup(queryResult: AgendaImportHistoryPage = emptyPage) {
  const historyQuery = { findAll: vi.fn().mockResolvedValue(queryResult) };
  const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
  const useCase = new ListAgendaImports({ historyQuery, auditWriter });
  return { useCase, historyQuery, auditWriter };
}

describe('ListAgendaImports', () => {
  it('devuelve lista vacía con nextCursor=null y audita success', async () => {
    const { useCase, auditWriter } = setup();
    const result = await useCase.execute({ pagination: { limit: 20 }, context: makeContext() });
    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'success')).toBeDefined();
  });

  it('usa agendaDate como resourceId del audit cuando se proporciona el filtro', async () => {
    const { useCase, historyQuery, auditWriter } = setup(pageWithItem);
    await useCase.execute({ agendaDate: '2026-08-25', pagination: { limit: 10 }, context: makeContext() });
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'success')![0].resourceId).toBe('2026-08-25');
    expect(historyQuery.findAll).toHaveBeenCalledWith('2026-08-25', expect.any(Object), tenant);
  });

  it('usa AGENDA_IMPORT_LIST como resourceId del audit cuando no hay filtro de fecha', async () => {
    const { useCase, auditWriter } = setup();
    await useCase.execute({ pagination: { limit: 10 }, context: makeContext() });
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'success')![0].resourceId).toBe('AGENDA_IMPORT_LIST');
  });

  it('propaga el cursor al query port', async () => {
    const { useCase, historyQuery } = setup(pageWithItem);
    await useCase.execute({ pagination: { cursor: 'cursor-prev', limit: 10 }, context: makeContext() });
    expect(historyQuery.findAll).toHaveBeenCalledWith(undefined, { cursor: 'cursor-prev', limit: 10 }, tenant);
  });

  it('audita denied y lanza PERMISSION_DENIED sin consultar datos', async () => {
    const { useCase, historyQuery, auditWriter } = setup();
    await expect(useCase.execute({ pagination: { limit: 10 }, context: makeContext([]) }))
      .rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });
    expect(historyQuery.findAll).not.toHaveBeenCalled();
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'denied')).toBeDefined();
  });
});
