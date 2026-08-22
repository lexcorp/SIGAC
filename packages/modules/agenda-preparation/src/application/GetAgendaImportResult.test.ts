import type { AuditEntry } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { ImportacionAgendaId } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import { GetAgendaImportResult } from './GetAgendaImportResult.js';
import type { AgendaImportResult } from './ports/ReadQueryPorts.js';

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

const importacionId = ImportacionAgendaId.parse('import-001');

const sampleResult: AgendaImportResult = {
  summary: {
    importacionId: 'import-001',
    agendaDate: '2026-08-25',
    importedAt: new Date('2026-08-25T10:00:00Z'),
    outcome: 'IMPORTED',
    metrics: {
      receivedRecords: 2, processed: 2, added: 2, updated: 0, unchanged: 0,
      restored: 0, pendingReview: 0, rejected: 0, duplicateFolio: 0,
      withdrawnFromAgenda: 0, incidents: 0, errors: 0,
    },
    hasChanges: true,
  },
  registros: [
    { registroId: 'reg-001', sourcePosition: 1, folio: 'FOLIO-001',
      processingResult: 'ADDED', incidentCodes: [] },
    { registroId: 'reg-002', sourcePosition: 2, folio: 'FOLIO-002',
      processingResult: 'ADDED', incidentCodes: [] },
  ],
};

function setup(queryResult: AgendaImportResult | null = sampleResult) {
  const importResultQuery = { findById: vi.fn().mockResolvedValue(queryResult) };
  const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
  const useCase = new GetAgendaImportResult({ importResultQuery, auditWriter });
  return { useCase, importResultQuery, auditWriter };
}

describe('GetAgendaImportResult', () => {
  it('devuelve summary y registros con campos exactos y audita success', async () => {
    const { useCase, importResultQuery, auditWriter } = setup();
    const result = await useCase.execute({ importacionId, context: makeContext() });

    expect(result.summary.importacionId).toBe('import-001');
    expect(result.summary.agendaDate).toBe('2026-08-25');
    expect(result.summary.metrics.receivedRecords).toBe(2);
    expect(result.summary.metrics.added).toBe(2);
    expect(result.registros).toHaveLength(2);
    expect(result.registros[0].folio).toBe('FOLIO-001');
    expect(result.registros[0].incidentCodes).toEqual([]);
    expect(result.summary).not.toHaveProperty('fingerprint');
    expect(result.summary).not.toHaveProperty('rawContent');
    expect(importResultQuery.findById).toHaveBeenCalledWith(importacionId, tenant);

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    const success = calls.find(([e]) => e.result === 'success');
    expect(success).toBeDefined();
    expect(success![0].action).toBe('AGENDA_VIEW');
    expect(success![0].resourceType).toBe('AGENDA_IMPORT');
    expect(success![0].resourceId).toBe('import-001');
  });

  it('audita denied y lanza PERMISSION_DENIED sin consultar datos', async () => {
    const { useCase, importResultQuery, auditWriter } = setup();
    await expect(useCase.execute({ importacionId, context: makeContext([]) }))
      .rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });
    expect(importResultQuery.findById).not.toHaveBeenCalled();
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'denied')).toBeDefined();
  });

  it('audita not-found y lanza AGENDA_IMPORT_NOT_FOUND cuando no existe', async () => {
    const { useCase, auditWriter } = setup(null);
    await expect(useCase.execute({ importacionId, context: makeContext() }))
      .rejects.toMatchObject({ name: 'ApplicationError', code: 'AGENDA_IMPORT_NOT_FOUND' });
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'not-found')).toBeDefined();
  });

  it('propaga el tenant correcto al query port', async () => {
    const { useCase, importResultQuery } = setup();
    await useCase.execute({ importacionId, context: makeContext() });
    expect(importResultQuery.findById).toHaveBeenCalledWith(importacionId, tenant);
  });
});
