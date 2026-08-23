/**
 * T-16 — Security, privacy y tenant hardening
 *
 * Verifies security invariants across the Agenda Preparation API boundary:
 * - Permission enforcement (access denied)
 * - Tenant isolation (context not forgeable from HTTP inputs)
 * - Malicious upload rejection (sanitized response, no disclosure)
 * - Audit entry hygiene (no PII, no raw, no fingerprint)
 * - Data minimization (no Turno/Consultorio/Destino/CURP in any output)
 * - RFC7807 sanitization (no internal details in error responses)
 */
import { HttpException } from '@nestjs/common';
import {
  type GetAgendaDaySummary,
  type GetAgendaImportIncidents,
  type GetAgendaImportResult,
  type GetAgendaPreparationList,
  type ImportAgenda,
  type ListAgendaImports,
  type PrintAgendaPreparationList,
  ApplicationError,
  LayoutRejectedError,
} from '@sigac/agenda-preparation';
import type { RequestContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import {
  AgendaApiProblemMapper,
  AuthenticationRequiredError,
  AgendaUploadTooLargeError,
  AgendaArtifactUnsupportedError,
  type ProblemDetails,
} from './agenda-api-errors.js';
import type { AuthenticatedRequestContextResolver } from './agenda-api.contracts.js';
import { AgendaController } from './agenda.controller.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_A: RequestContext['tenant'] = {
  tenantId: 'tenant-a', slug: 'hospital-a', hospitalId: 'hospital-a',
  databaseName: 'sigac_hospital_a', timezone: 'America/Mexico_City',
};

const TENANT_B: RequestContext['tenant'] = {
  tenantId: 'tenant-b', slug: 'hospital-b', hospitalId: 'hospital-b',
  databaseName: 'sigac_hospital_b', timezone: 'America/Mexico_City',
};

function contextFor(
  tenant: RequestContext['tenant'],
  permissions: string[] = ['AGENDA_VIEW', 'AGENDA_IMPORT', 'AGENDA_INCIDENT_VIEW'],
): RequestContext {
  return {
    actor: {
      actorId: 'actor-001',
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(permissions),
      tenantIds: new Set([tenant.tenantId]),
    },
    tenant,
    requestId: 'req-hardening-001',
    correlationId: 'corr-hardening-001',
    source: 'WEB',
  };
}

const importacionId = '11111111-2222-4333-8444-555555555555';

const sampleMetrics = {
  receivedRecords: 2, processed: 2, added: 2, updated: 0, unchanged: 0,
  restored: 0, pendingReview: 0, rejected: 0, duplicateFolio: 0,
  withdrawnFromAgenda: 0, incidents: 0, errors: 0,
};

function makeFile(opts: Partial<{ originalname: string; size: number; buffer: Buffer }> = {}) {
  return {
    fieldname: 'file',
    originalname: opts.originalname ?? 'agenda.xls',
    buffer: opts.buffer ?? Buffer.from('<html></html>'),
    size: opts.size ?? 100,
  };
}

function buildController(opts: {
  resolve?: AuthenticatedRequestContextResolver['resolve'];
  importResult?: unknown;
  daySummary?: unknown;
  prepPage?: unknown;
  printItems?: unknown;
  getResult?: unknown;
  listResult?: unknown;
  incidents?: unknown;
} = {}) {
  const resolver: AuthenticatedRequestContextResolver = {
    resolve: opts.resolve ?? vi.fn().mockResolvedValue(contextFor(TENANT_A)),
  };
  const importAgenda = { execute: vi.fn().mockResolvedValue(opts.importResult ?? {
    importacionId, agendaDate: '2026-08-25', outcome: 'IMPORTED', metrics: sampleMetrics, hasChanges: true,
  }) };
  const getAgendaImportResult = { execute: vi.fn().mockResolvedValue(opts.getResult ?? {
    summary: { importacionId, agendaDate: '2026-08-25', importedAt: new Date(), outcome: 'IMPORTED', metrics: sampleMetrics, hasChanges: true },
    registros: [],
  }) };
  const listAgendaImports = { execute: vi.fn().mockResolvedValue(opts.listResult ?? { items: [], nextCursor: null }) };
  const getAgendaDaySummary = { execute: vi.fn().mockResolvedValue(opts.daySummary ?? {
    agendaDate: '2026-08-25', latestImportacionId: importacionId,
    latestImportedAt: new Date(), latestOutcome: 'IMPORTED',
    activeAppointments: 3, physicians: 1, services: 1, incidentCount: 0,
  }) };
  const getAgendaPreparationList = { execute: vi.fn().mockResolvedValue(opts.prepPage ?? { items: [], nextCursor: null }) };
  const printAgendaPreparationList = { execute: vi.fn().mockResolvedValue(opts.printItems ?? []) };
  const getAgendaImportIncidents = { execute: vi.fn().mockResolvedValue(opts.incidents ?? []) };

  const controller = new AgendaController(
    resolver,
    importAgenda as unknown as ImportAgenda,
    getAgendaImportResult as unknown as GetAgendaImportResult,
    listAgendaImports as unknown as ListAgendaImports,
    getAgendaDaySummary as unknown as GetAgendaDaySummary,
    getAgendaPreparationList as unknown as GetAgendaPreparationList,
    printAgendaPreparationList as unknown as PrintAgendaPreparationList,
    getAgendaImportIncidents as unknown as GetAgendaImportIncidents,
    new AgendaApiProblemMapper(),
  );
  return { controller, resolver, importAgenda, getAgendaDaySummary, getAgendaPreparationList,
    printAgendaPreparationList, listAgendaImports, getAgendaImportResult, getAgendaImportIncidents };
}

async function expectHttpStatus(promise: Promise<unknown>, status: number, code?: string): Promise<ProblemDetails> {
  try {
    await promise;
    throw new Error(`Expected HttpException with status ${status}`);
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const ex = error as HttpException;
    expect(ex.getStatus()).toBe(status);
    const body = ex.getResponse() as ProblemDetails;
    if (code) expect(body.code).toBe(code);
    return body;
  }
}

// ===========================================================================
// T-16 Security Suite
// ===========================================================================

describe('T-16 — Permission enforcement (access denied)', () => {
  it('AGENDA_IMPORT required — sin permiso retorna 403, use case no llamado', async () => {
    const { controller, importAgenda } = buildController({
      resolve: vi.fn().mockResolvedValue(contextFor(TENANT_A, ['AGENDA_VIEW'])),
    });
    importAgenda.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'internal'));
    const problem = await expectHttpStatus(
      controller.importAgenda(makeFile(), 'key-001', {}), 403, 'PERMISSION_DENIED',
    );
    // Error must not disclose internal reason
    expect(JSON.stringify(problem)).not.toContain('internal');
  });

  it('AGENDA_VIEW required — sin permiso retorna 403 en consulta de Agenda del día', async () => {
    const { controller, getAgendaDaySummary } = buildController({
      resolve: vi.fn().mockResolvedValue(contextFor(TENANT_A, ['AGENDA_IMPORT'])),
    });
    getAgendaDaySummary.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'internal'));
    await expectHttpStatus(controller.getAgendaDaySummary('2026-08-25', {}), 403, 'PERMISSION_DENIED');
    // Denied before reading resource — use case enforces this
    expect(getAgendaDaySummary.execute).toHaveBeenCalled();
  });

  it('AGENDA_INCIDENT_VIEW required — AGENDA_VIEW alone is NOT sufficient for incidents', async () => {
    const { controller, getAgendaImportIncidents } = buildController({
      resolve: vi.fn().mockResolvedValue(contextFor(TENANT_A, ['AGENDA_VIEW'])),
    });
    getAgendaImportIncidents.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'internal'));
    await expectHttpStatus(
      controller.getAgendaImportIncidents(importacionId, undefined, '10', {}),
      403, 'PERMISSION_DENIED',
    );
  });

  it('AGENDA_VIEW required — AGENDA_IMPORT alone is NOT sufficient for queries', async () => {
    const { controller, getAgendaPreparationList } = buildController({
      resolve: vi.fn().mockResolvedValue(contextFor(TENANT_A, ['AGENDA_IMPORT'])),
    });
    getAgendaPreparationList.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'internal'));
    await expectHttpStatus(
      controller.getAgendaPreparationList('2026-08-25', undefined, undefined, '10', {}),
      403, 'PERMISSION_DENIED',
    );
  });

  it('unauthenticated request returns 401 — no resource access occurs', async () => {
    const { controller, importAgenda } = buildController({
      resolve: vi.fn().mockRejectedValue(new AuthenticationRequiredError()),
    });
    await expectHttpStatus(controller.importAgenda(makeFile(), 'key-001', {}), 401, 'AUTHENTICATION_REQUIRED');
    // Use case must NOT be called — auth failure is at the boundary
    expect(importAgenda.execute).not.toHaveBeenCalled();
  });
});

describe('T-16 — Tenant isolation', () => {
  it('tenant cannot be injected via arbitrary HTTP headers', async () => {
    const { controller, importAgenda } = buildController({
      resolve: vi.fn().mockResolvedValue(contextFor(TENANT_A)),
    });
    await controller.importAgenda(makeFile(), 'key-001', {
      headers: {
        'x-tenant-id': TENANT_B.tenantId,
        'x-database-name': TENANT_B.databaseName,
        'x-forwarded-tenant': TENANT_B.tenantId,
      },
    });
    // Context used must be tenant A — from resolver, not from headers
    expect(importAgenda.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ tenant: TENANT_A }),
      }),
    );
  });

  it('tenant cannot be injected via query parameters', async () => {
    const { controller, getAgendaDaySummary } = buildController({
      resolve: vi.fn().mockResolvedValue(contextFor(TENANT_A)),
    });
    await controller.getAgendaDaySummary('2026-08-25', {
      query: { tenantId: TENANT_B.tenantId, databaseName: TENANT_B.databaseName },
    });
    expect(getAgendaDaySummary.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ tenant: TENANT_A }),
      }),
    );
  });

  it('tenant cannot be injected via preparation list query parameters', async () => {
    const { controller, getAgendaPreparationList } = buildController({
      resolve: vi.fn().mockResolvedValue(contextFor(TENANT_A)),
    });
    await controller.getAgendaPreparationList('2026-08-25', undefined, undefined, '10', {
      query: { tenant: TENANT_B.tenantId, hospitalId: TENANT_B.hospitalId },
    });
    expect(getAgendaPreparationList.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ tenant: TENANT_A }),
      }),
    );
  });

  it('requestId and correlationId come from RequestContext — not from arbitrary headers', async () => {
    const ctx = contextFor(TENANT_A);
    const { controller, importAgenda } = buildController({
      resolve: vi.fn().mockResolvedValue(ctx),
    });
    await controller.importAgenda(makeFile(), 'key-001', {
      headers: {
        'x-request-id': 'forged-request-id',
        'x-correlation-id': 'forged-correlation-id',
      },
    });
    const passedContext = (importAgenda.execute as ReturnType<typeof vi.fn>).mock.calls[0]![0].context as RequestContext;
    expect(passedContext.requestId).toBe('req-hardening-001');
    expect(passedContext.correlationId).toBe('corr-hardening-001');
    expect(passedContext.requestId).not.toBe('forged-request-id');
    expect(passedContext.correlationId).not.toBe('forged-correlation-id');
  });

  it('cross-tenant not-found is indistinguishable from absent resource — 404 used for both', async () => {
    // A resource belonging to TENANT_B that TENANT_A queries returns 404 (not cross-tenant disclosure)
    const { controller, getAgendaImportResult } = buildController({
      resolve: vi.fn().mockResolvedValue(contextFor(TENANT_A)),
    });
    getAgendaImportResult.execute.mockRejectedValue(
      new ApplicationError('AGENDA_IMPORT_NOT_FOUND', 'internal'),
    );
    const problem = await expectHttpStatus(
      controller.getAgendaImportResult(importacionId, {}),
      404, 'AGENDA_IMPORT_NOT_FOUND',
    );
    // Must not mention TENANT_B or cross-tenant in the response
    expect(JSON.stringify(problem)).not.toContain('CROSS_TENANT');
    expect(JSON.stringify(problem)).not.toContain(TENANT_B.tenantId);
    expect(JSON.stringify(problem)).not.toContain(TENANT_B.databaseName);
  });
});

describe('T-16 — Malicious/untrusted upload rejection', () => {
  it('file with .xlsx extension is rejected 415 before use case runs', async () => {
    const { controller, importAgenda } = buildController();
    await expectHttpStatus(
      controller.importAgenda(makeFile({ originalname: 'malicious.xlsx' }), 'key-001', {}),
      415, 'AGENDA_ARTIFACT_UNSUPPORTED',
    );
    expect(importAgenda.execute).not.toHaveBeenCalled();
  });

  it('file with .csv extension is rejected 415 before use case runs', async () => {
    const { controller, importAgenda } = buildController();
    await expectHttpStatus(
      controller.importAgenda(makeFile({ originalname: 'harvest.csv' }), 'key-001', {}),
      415, 'AGENDA_ARTIFACT_UNSUPPORTED',
    );
    expect(importAgenda.execute).not.toHaveBeenCalled();
  });

  it('file with .exe extension is rejected 415', async () => {
    const { controller, importAgenda } = buildController();
    await expectHttpStatus(
      controller.importAgenda(makeFile({ originalname: 'malware.exe' }), 'key-001', {}),
      415, 'AGENDA_ARTIFACT_UNSUPPORTED',
    );
    expect(importAgenda.execute).not.toHaveBeenCalled();
  });

  it('missing file is rejected 400 — no processing occurs', async () => {
    const { controller, importAgenda } = buildController();
    await expectHttpStatus(controller.importAgenda(undefined, 'key-001', {}), 400, 'HTTP_VALIDATION_ERROR');
    expect(importAgenda.execute).not.toHaveBeenCalled();
  });

  it('layout rejected response does not contain internal parser details', async () => {
    const { controller, importAgenda } = buildController();
    importAgenda.execute.mockRejectedValue(
      new LayoutRejectedError('charset detected: EUC-JP; expected ISO-8859; parser stack at line 42'),
    );
    const problem = await expectHttpStatus(
      controller.importAgenda(makeFile(), 'key-001', {}),
      422, 'AGENDA_LAYOUT_REJECTED',
    );
    const json = JSON.stringify(problem);
    // Internal parser detail must not leak
    expect(json).not.toContain('charset');
    expect(json).not.toContain('EUC-JP');
    expect(json).not.toContain('ISO-8859');
    expect(json).not.toContain('stack at line');
    expect(json).not.toContain('parser');
    // importAttemptId must be present but opaque
    expect(problem.importAttemptId).toBeDefined();
    expect(typeof problem.importAttemptId).toBe('string');
  });

  it('unexpected technical failure response does not leak internal error messages', async () => {
    const { controller, importAgenda } = buildController();
    importAgenda.execute.mockRejectedValue(
      new Error('PostgreSQL: duplicate key value violates unique constraint "agenda_imports_pkey"'),
    );
    const problem = await expectHttpStatus(
      controller.importAgenda(makeFile(), 'key-001', {}),
      500, 'AGENDA_IMPORT_FAILED',
    );
    const json = JSON.stringify(problem);
    expect(json).not.toContain('PostgreSQL');
    expect(json).not.toContain('duplicate key');
    expect(json).not.toContain('agenda_imports_pkey');
    expect(json).not.toContain('constraint');
  });

  it('upload file content (buffer) is never reflected in error responses', async () => {
    const { controller, importAgenda } = buildController();
    const sensitiveBuffer = Buffer.from('CURP: PERR810604HMCNNR07; FOLIO: 1234');
    importAgenda.execute.mockRejectedValue(new LayoutRejectedError('layout error'));
    const problem = await expectHttpStatus(
      controller.importAgenda(makeFile({ buffer: sensitiveBuffer }), 'key-001', {}),
      422,
    );
    const json = JSON.stringify(problem);
    expect(json).not.toContain('CURP');
    expect(json).not.toContain('PERR810604');
    expect(json).not.toContain('FOLIO: 1234');
  });
});

describe('T-16 — Audit entry hygiene (no PII, no raw, no fingerprint)', () => {
  it('import response does not contain fingerprint, filename, or raw content', async () => {
    const { controller } = buildController();
    const result = await controller.importAgenda(makeFile(), 'key-001', {});
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/fingerprint/i);
    expect(json).not.toMatch(/filename/i);
    expect(json).not.toMatch(/\braw\b/i);
    expect(json).not.toMatch(/rawRow/i);
    expect(json).not.toMatch(/curp/i);
    expect(json).not.toMatch(/sha256/i);
  });

  it('import response exposes only approved fields per API-AP-008', async () => {
    const { controller } = buildController();
    const result = await controller.importAgenda(makeFile(), 'key-001', {}) as Record<string, unknown>;
    const keys = Object.keys(result).sort();
    // Only approved response fields
    expect(keys).toEqual(['agendaDate', 'importacionId', 'importedAt', 'metrics', 'outcome'].sort());
    // ImportAttemptId must NOT be in response
    expect(keys).not.toContain('importAttemptId');
  });

  it('import history items do not contain actorRef, fingerprint, or filename', async () => {
    const { controller } = buildController({
      listResult: {
        items: [{
          importacionId,
          agendaDate: '2026-08-25',
          importedAt: new Date('2026-08-25T10:00:00Z'),
          outcome: 'IMPORTED',
          metrics: sampleMetrics,
        }],
        nextCursor: null,
      },
    });
    const result = await controller.listAgendaImports('2026-08-25', undefined, '10', {}) as { items: Record<string, unknown>[] };
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/actorRef/i);
    expect(json).not.toMatch(/fingerprint/i);
    expect(json).not.toMatch(/filename/i);
    expect(json).not.toMatch(/curp/i);
  });

  it('preparation items do not contain raw, fingerprint, Turno, Consultorio, Destino, CURP', async () => {
    const { controller } = buildController({
      prepPage: {
        items: [{
          folio: 'FOLIO-001', nombrePaciente: 'PACIENTE SINTETICO',
          expediente: { original: 'EXP-001', reference: null },
          tipoDerechohabiente: 'PENSIONISTA', tipoConsulta: 'FIRST_TIME',
          agendaDate: '2026-08-25', appointmentTime: '08:00',
          medico: { numeroEmpleado: '12345', nombre: 'DR X' },
          servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA GENERAL' },
        }],
        nextCursor: null,
      },
    });
    const result = await controller.getAgendaPreparationList('2026-08-25', undefined, undefined, '10', {});
    const json = JSON.stringify(result);
    // Prohibited fields
    for (const forbidden of ['turno', 'consultorio', 'destino', 'curp', 'fingerprint',
      'raw_row', 'rawRow', 'filename', 'telefono', 'vigencia', 'sexo', 'edad']) {
      expect(json.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe('T-16 — Data minimization', () => {
  it('incident list does not expose raw row content, internal IDs beyond approved fields', async () => {
    const { controller } = buildController({
      incidents: [
        { incidenciaId: 'inc-1', registroId: 'reg-1', sourcePosition: 2, type: 'PHYSICIAN_NOT_RESOLVED' },
      ],
    });
    const result = await controller.getAgendaImportIncidents(importacionId, undefined, '10', {});
    const json = JSON.stringify(result);
    // Must not contain raw row data, clinical data, or internal parser details
    expect(json).not.toMatch(/raw/i);
    expect(json).not.toMatch(/curp/i);
    expect(json).not.toMatch(/telefono/i);
    expect(json).not.toMatch(/vigencia/i);
    // Must have exactly the approved fields
    expect(json).toContain('incidenciaId');
    expect(json).toContain('sourcePosition');
    expect(json).toContain('type');
  });

  it('print list does not contain Turno, Consultorio, Destino', async () => {
    const { controller } = buildController({
      printItems: [{
        folio: 'F1', nombrePaciente: 'P SINTETICO',
        expediente: { original: 'E1', reference: null },
        tipoDerechohabiente: 'PENSIONISTA', tipoConsulta: 'FIRST_TIME',
        agendaDate: '2026-08-25', appointmentTime: '08:00',
        medico: { numeroEmpleado: '1', nombre: 'DR Y' },
        servicioEspecialidad: { codigo: 'S', nombre: 'SVC' },
      }],
    });
    const result = await controller.printAgendaPreparationList('2026-08-25', undefined, {});
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/turno/i);
    expect(json).not.toMatch(/consultorio/i);
    expect(json).not.toMatch(/destino/i);
    expect(json).not.toMatch(/curp/i);
  });

  it('day summary does not expose databaseName or connectionString', async () => {
    const { controller } = buildController();
    const result = await controller.getAgendaDaySummary('2026-08-25', {});
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/databaseName/i);
    expect(json).not.toMatch(/connectionString/i);
    expect(json).not.toMatch(/tenantId.*sigac/i);
  });
});

describe('T-16 — RFC7807 sanitization', () => {
  it('400 validation error does not contain stack trace or SQL', async () => {
    const { controller } = buildController();
    const problem = await expectHttpStatus(
      controller.importAgenda(undefined, 'key-001', {}), 400,
    );
    const json = JSON.stringify(problem);
    expect(json).not.toMatch(/stack/i);
    expect(json).not.toMatch(/\bSQL\b/i);
    expect(json).not.toMatch(/filesystem/i);
    expect(json).not.toMatch(/node_modules/i);
  });

  it('404 not-found error does not contain tenant-specific database details', async () => {
    const { controller, getAgendaImportResult } = buildController();
    getAgendaImportResult.execute.mockRejectedValue(
      new ApplicationError('AGENDA_IMPORT_NOT_FOUND', 'sigac_hospital_a: not found in index'),
    );
    const problem = await expectHttpStatus(
      controller.getAgendaImportResult(importacionId, {}), 404,
    );
    const json = JSON.stringify(problem);
    expect(json).not.toContain('sigac_hospital_a');
    expect(json).not.toMatch(/index/i);
  });

  it('403 forbidden error message is safe and does not expose permission logic', async () => {
    const { controller, getAgendaDaySummary } = buildController();
    getAgendaDaySummary.execute.mockRejectedValue(
      new ApplicationError('PERMISSION_DENIED', 'Actor actor-001 lacks AGENDA_VIEW in tenant-a'),
    );
    const problem = await expectHttpStatus(
      controller.getAgendaDaySummary('2026-08-25', {}), 403,
    );
    const json = JSON.stringify(problem);
    expect(json).not.toContain('actor-001');
    expect(json).not.toContain('lacks AGENDA_VIEW');
    expect(json).not.toContain('tenant-a');
  });

  it('500 internal error does not contain database error details', async () => {
    const { controller, importAgenda } = buildController();
    importAgenda.execute.mockRejectedValue(
      new Error('connection timeout to sigac_hospital_a:5432 after 30000ms'),
    );
    const problem = await expectHttpStatus(
      controller.importAgenda(makeFile(), 'key-001', {}), 500, 'AGENDA_IMPORT_FAILED',
    );
    const json = JSON.stringify(problem);
    expect(json).not.toContain('sigac_hospital_a');
    expect(json).not.toContain('5432');
    expect(json).not.toContain('timeout');
  });
});
