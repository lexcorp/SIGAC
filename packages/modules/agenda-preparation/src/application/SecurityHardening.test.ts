/**
 * T-16 — Application-level security invariants
 *
 * Verifies that:
 * 1. All use cases enforce permission before accessing data
 * 2. Audit entries contain no PII or raw artifact data
 * 3. Wrong permission class is always denied
 * 4. Tenant isolation at Application level
 */
import type { AuditEntry } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { AgendaFecha, ImportacionAgendaId } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import { GetAgendaDaySummary } from './GetAgendaDaySummary.js';
import { GetAgendaImportIncidents } from './GetAgendaImportIncidents.js';
import { GetAgendaImportResult } from './GetAgendaImportResult.js';
import { GetAgendaPreparationList } from './GetAgendaPreparationList.js';
import { ImportAgenda, LayoutRejectedError } from './ImportAgenda.js';
import { ListAgendaImports } from './ListAgendaImports.js';
import { PrintAgendaPreparationList } from './PrintAgendaPreparationList.js';
import type { AgendaPreparationTransaction } from './ports/AgendaPreparationUnitOfWork.js';
import type { InterpretedAgendaFile } from './ports/AgendaFileInterpreterPort.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_A: TenantContext = {
  tenantId: 'tenant-a', slug: 'hospital-a', hospitalId: 'hospital-a',
  databaseName: 'sigac_a', timezone: 'America/Mexico_City',
};

const TENANT_B: TenantContext = {
  tenantId: 'tenant-b', slug: 'hospital-b', hospitalId: 'hospital-b',
  databaseName: 'sigac_b', timezone: 'America/Mexico_City',
};

function makeContext(permissions: string[], tenant: TenantContext = TENANT_A): RequestContext {
  return {
    actor: {
      actorId: 'actor-hardening',
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(permissions),
      tenantIds: new Set([tenant.tenantId]),
    },
    tenant,
    requestId: 'req-h-001',
    correlationId: 'corr-h-001',
    source: 'WEB',
  };
}

const agendaDate = AgendaFecha.parse('2026-08-25');
const importacionId = ImportacionAgendaId.parse('11111111-2222-4333-8444-555555555555');
const stubFile = { sizeBytes: 50, open: async function* () { yield new Uint8Array(); } };

function makeImportMocks() {
  const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
  const importedAt = new Date('2026-08-25T10:00:00Z');

  const tx: AgendaPreparationTransaction = {
    importacionAgendaRepository: { save: vi.fn().mockResolvedValue(undefined) },
    agendaRepository: {
      findByFecha: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    },
    importArtifactMetadataRepository: {
      findEquivalent: vi.fn().mockResolvedValue(null),
      associateConfirmedImport: vi.fn().mockResolvedValue(undefined),
    },
    idempotencyKeyRepository: {
      findByKey: vi.fn().mockResolvedValue(null),
      recordKey: vi.fn().mockResolvedValue(undefined),
    },
    auditWriter,
    importedAt,
  };

  const unitOfWork = {
    execute: vi.fn().mockImplementation(
      async (_t: TenantContext, op: (t: AgendaPreparationTransaction) => Promise<unknown>) => op(tx),
    ),
  };

  const importedFile: InterpretedAgendaFile = {
    fingerprint: { value: 'sha256-synthetic-hardening' },
    layout: 'SIMEF_HTML_V1',
    agendaDate,
    rows: [],
  };

  const useCase = new ImportAgenda({
    interpreter: {
      inspect: vi.fn().mockResolvedValue({}),
      interpret: vi.fn().mockResolvedValue(importedFile),
    },
    medicoQuery: {
      findByEmployeeNumber: vi.fn().mockResolvedValue({ kind: 'NOT_FOUND' }),
      findControlledFallback: vi.fn().mockResolvedValue({ kind: 'NOT_FOUND' }),
    },
    expedienteQuery: { resolve: vi.fn().mockResolvedValue([]) },
    metadataRepository: {
      findEquivalent: vi.fn().mockResolvedValue(null),
      associateConfirmedImport: vi.fn().mockResolvedValue(undefined),
    },
    idempotencyKeyRepository: {
      findByKey: vi.fn().mockResolvedValue(null),
      recordKey: vi.fn().mockResolvedValue(undefined),
    },
    unitOfWork,
  });

  return { useCase, auditWriter, tx, unitOfWork };
}

// ===========================================================================
// T-16 Application Security Tests
// ===========================================================================

describe('T-16 Application — permission enforcement before data access', () => {
  it('GetAgendaDaySummary: dayQuery NOT called when PERMISSION_DENIED', async () => {
    const dayQuery = { findByDate: vi.fn().mockResolvedValue(null) };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaDaySummary({ dayQuery, auditWriter });

    await expect(useCase.execute({
      agendaDate,
      context: makeContext([/* no AGENDA_VIEW */]),
    })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    expect(dayQuery.findByDate).not.toHaveBeenCalled();
  });

  it('GetAgendaPreparationList: query NOT called when wrong permission', async () => {
    const preparationQuery = { findPage: vi.fn(), listForPrint: vi.fn() };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaPreparationList({ preparationQuery, auditWriter });

    await expect(useCase.execute({
      agendaDate,
      order: 'APPOINTMENT_TIME_ASC',
      pagination: { limit: 10 },
      context: makeContext(['AGENDA_INCIDENT_VIEW']), // wrong permission
    })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    expect(preparationQuery.findPage).not.toHaveBeenCalled();
  });

  it('GetAgendaImportIncidents: query NOT called when AGENDA_INCIDENT_VIEW missing', async () => {
    const incidentsQuery = { findByImportacionId: vi.fn() };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaImportIncidents({ incidentsQuery, auditWriter });

    await expect(useCase.execute({
      importacionId,
      context: makeContext(['AGENDA_VIEW']), // AGENDA_VIEW alone not enough
    })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    expect(incidentsQuery.findByImportacionId).not.toHaveBeenCalled();
  });

  it('ListAgendaImports: denied with AGENDA_INCIDENT_VIEW (not AGENDA_VIEW)', async () => {
    const historyQuery = { findAll: vi.fn() };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new ListAgendaImports({ historyQuery, auditWriter });

    await expect(useCase.execute({
      pagination: { limit: 10 },
      context: makeContext(['AGENDA_INCIDENT_VIEW']),
    })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    expect(historyQuery.findAll).not.toHaveBeenCalled();
  });

  it('PrintAgendaPreparationList: denied with AGENDA_IMPORT (not AGENDA_VIEW)', async () => {
    const preparationQuery = { listForPrint: vi.fn(), findPage: vi.fn() };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new PrintAgendaPreparationList({ preparationQuery, auditWriter });

    await expect(useCase.execute({
      agendaDate,
      order: 'APPOINTMENT_TIME_ASC',
      context: makeContext(['AGENDA_IMPORT']),
    })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    expect(preparationQuery.listForPrint).not.toHaveBeenCalled();
  });

  it('GetAgendaImportResult: query NOT called when permission missing', async () => {
    const importResultQuery = { findById: vi.fn() };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaImportResult({ importResultQuery, auditWriter });

    await expect(useCase.execute({
      importacionId,
      context: makeContext([/* empty permissions */]),
    })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    expect(importResultQuery.findById).not.toHaveBeenCalled();
  });
});

describe('T-16 Application — audit entries contain no PII or raw artifact data', () => {
  it('import success AuditEntry has no PII, fingerprint, raw, or filename', async () => {
    const { useCase, auditWriter } = makeImportMocks();

    await useCase.execute({
      importAttemptId: 'attempt-sec-001',
      idempotencyKey: 'key-sec-001',
      file: stubFile,
      context: makeContext(['AGENDA_IMPORT']),
    });

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    const successCall = calls.find(([e]) => e.result === 'success');
    expect(successCall).toBeDefined();
    const [entry, ctx] = successCall!;

    const entryJson = JSON.stringify(entry);
    // No PII
    expect(entryJson).not.toMatch(/paciente|patient|nombre/i);
    expect(entryJson).not.toMatch(/curp/i);
    expect(entryJson).not.toMatch(/telefono/i);
    // No raw artifact
    expect(entryJson).not.toMatch(/\braw\b/i);
    expect(entryJson).not.toMatch(/html/i);
    expect(entryJson).not.toMatch(/fingerprint/i);
    expect(entryJson).not.toMatch(/filename/i);
    expect(entryJson).not.toMatch(/sha256/i);

    // Only approved fields
    expect(entry.action).toBe('AGENDA_IMPORT');
    expect(entry.resourceType).toBe('AGENDA_IMPORT');
    expect(typeof entry.resourceId).toBe('string');
    expect(entry.result).toBe('success');
    expect(entry.changeSummary).toBeUndefined();

    // Context carries correct tenant — not forged
    expect(ctx.tenant.tenantId).toBe('tenant-a');
  });

  it('denied import AuditEntry uses AGENDA_IMPORT_ATTEMPT — no patient data', async () => {
    const { useCase, auditWriter } = makeImportMocks();

    await useCase.execute({
      importAttemptId: 'attempt-sec-denied',
      idempotencyKey: 'key-sec-denied',
      file: stubFile,
      context: makeContext([/* no AGENDA_IMPORT */]),
    }).catch(() => { /* expected */ });

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    const deniedCall = calls.find(([e]) => e.result === 'denied');
    expect(deniedCall).toBeDefined();
    const [deniedEntry] = deniedCall!;

    expect(deniedEntry.action).toBe('AGENDA_IMPORT');
    expect(deniedEntry.resourceType).toBe('AGENDA_IMPORT_ATTEMPT');
    expect(deniedEntry.resourceId).toBe('attempt-sec-denied');

    const entryJson = JSON.stringify(deniedEntry);
    expect(entryJson).not.toMatch(/filename/i);
    expect(entryJson).not.toMatch(/fingerprint/i);
    expect(entryJson).not.toMatch(/\braw\b/i);
    expect(entryJson).not.toMatch(/curp/i);
  });

  it('GetAgendaDaySummary success AuditEntry uses AGENDA date as resourceId — no PII', async () => {
    const dayQuery = {
      findByDate: vi.fn().mockResolvedValue({
        agendaDate: '2026-08-25', latestImportacionId: 'imp-sec-001',
        latestImportedAt: new Date(), latestOutcome: 'IMPORTED',
        activeAppointments: 5, physicians: 2, services: 1, incidentCount: 0,
      }),
    };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaDaySummary({ dayQuery, auditWriter });

    await useCase.execute({ agendaDate, context: makeContext(['AGENDA_VIEW']) });

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    const successCall = calls.find(([e]) => e.result === 'success');
    expect(successCall).toBeDefined();
    const [entry] = successCall!;

    expect(entry.action).toBe('AGENDA_VIEW');
    expect(entry.resourceType).toBe('AGENDA');
    expect(entry.resourceId).toBe('2026-08-25');

    const entryJson = JSON.stringify(entry);
    expect(entryJson).not.toMatch(/paciente|patient/i);
    expect(entryJson).not.toMatch(/curp/i);
    expect(entryJson).not.toMatch(/fingerprint/i);
  });

  it('GetAgendaImportIncidents denied AuditEntry action is AGENDA_INCIDENT_VIEW', async () => {
    const incidentsQuery = { findByImportacionId: vi.fn() };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaImportIncidents({ incidentsQuery, auditWriter });

    await useCase.execute({
      importacionId,
      context: makeContext([/* no AGENDA_INCIDENT_VIEW */]),
    }).catch(() => { /* expected */ });

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    const deniedCall = calls.find(([e]) => e.result === 'denied');
    expect(deniedCall).toBeDefined();
    const [entry] = deniedCall!;

    expect(entry.action).toBe('AGENDA_INCIDENT_VIEW');
    expect(entry.resourceType).toBe('AGENDA_IMPORT');
    expect(JSON.stringify(entry)).not.toMatch(/curp|raw|filename|fingerprint/i);
  });
});

describe('T-16 Application — tenant isolation', () => {
  it('GetAgendaPreparationList uses context.tenant — not arbitrary input', async () => {
    const preparationQuery = {
      findPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      listForPrint: vi.fn(),
    };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaPreparationList({ preparationQuery, auditWriter });

    await useCase.execute({
      agendaDate,
      order: 'APPOINTMENT_TIME_ASC',
      pagination: { limit: 10 },
      context: makeContext(['AGENDA_VIEW'], TENANT_A),
    });

    const [, , , tenantUsed] = (preparationQuery.findPage as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[];
    expect(tenantUsed).toStrictEqual(TENANT_A);
    expect(tenantUsed).not.toStrictEqual(TENANT_B);
  });

  it('ImportAgenda routes UoW through context.tenant — not from file metadata', async () => {
    const { useCase, unitOfWork } = makeImportMocks();

    await useCase.execute({
      importAttemptId: 'attempt-tenant-check',
      idempotencyKey: 'key-tenant-check',
      file: stubFile,
      context: makeContext(['AGENDA_IMPORT'], TENANT_A),
    });

    const [uowTenant] = (unitOfWork.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [TenantContext, unknown];
    expect(uowTenant).toStrictEqual(TENANT_A);
    expect(uowTenant).not.toStrictEqual(TENANT_B);
  });

  it('ListAgendaImports uses context.tenant — never TENANT_B even if passed', async () => {
    const historyQuery = {
      findAll: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new ListAgendaImports({ historyQuery, auditWriter });

    await useCase.execute({
      pagination: { limit: 10 },
      context: makeContext(['AGENDA_VIEW'], TENANT_A),
    });

    const [, , tenantUsed] = (historyQuery.findAll as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[];
    expect(tenantUsed).toStrictEqual(TENANT_A);
    expect(tenantUsed).not.toStrictEqual(TENANT_B);
  });
});

// ===========================================================================
// T-25 — Application-level security: GeneratePreparationReport
//
// Fuentes: REQ-PR-006, REQ-PR-007, INV-PR-005, INV-PR-008, design.md §5.3.
// Complementa los tests de T-21 desde la perspectiva de seguridad.
// ===========================================================================

import { Readable } from 'node:stream';
import {
  GeneratePreparationReport,
  type GeneratePreparationReportCommand,
} from './use-cases/GeneratePreparationReport.js';
import type { PreparationItem } from './ports/ReadQueryPorts.js';

// Fixtures sintéticos T-25
const AGENDA_DATE_T25 = AgendaFecha.parse('2026-09-15');

const TENANT_PR: TenantContext = {
  tenantId: 'tenant-pr-t25',
  slug: 'hospital-pr-t25',
  hospitalId: 'hosp-pr-t25',
  databaseName: 'sigac_pr_t25',
  timezone: 'America/Mexico_City',
};

const TENANT_OTHER: TenantContext = {
  tenantId: 'tenant-other',
  slug: 'hospital-other',
  hospitalId: 'hosp-other',
  databaseName: 'sigac_other',
  timezone: 'America/Mexico_City',
};

function makePrContext(tenant: TenantContext = TENANT_PR): RequestContext {
  return {
    actor: {
      actorId: 'actor-pr-t25',
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(['AGENDA_VIEW', 'AGENDA_PRINT']),
      tenantIds: new Set([tenant.tenantId]),
    },
    tenant,
    requestId: 'req-pr-t25',
    correlationId: 'corr-pr-t25',
    source: 'WEB',
  };
}

function makePrItem(overrides: Partial<PreparationItem> = {}): PreparationItem {
  return {
    folio: 'FOLIO-T25-001',
    nombrePaciente: 'PACIENTE SINTETICO T25',
    expediente: { original: 'T25XX810101/10', reference: null },
    tipoDerechohabiente: '10',
    tipoConsulta: 'FIRST_TIME',
    agendaDate: '2026-09-15',
    appointmentTime: '08:00',
    medico: { numeroEmpleado: '77701', nombre: 'DR SINTETICO T25' },
    servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIOLOGIA SINTETICA' },
    ...overrides,
  };
}

function makePrMocks(items: readonly PreparationItem[] = [makePrItem()]) {
  const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
  const preparationListQuery = {
    findPage: vi.fn(),
    listForPrint: vi.fn().mockResolvedValue(items),
  };
  const reportGenerator = {
    generate: vi.fn().mockResolvedValue({
      stream: Readable.from(['%PDF-1.4 sintetico-t25']),
      filename: 'lista-preparacion-2026-09-15.pdf',
    }),
  };
  const useCase = new GeneratePreparationReport({
    preparationListQuery,
    reportGenerator,
    auditWriter,
  });
  return { useCase, preparationListQuery, reportGenerator, auditWriter };
}

function makePrCommand(
  overrides: Partial<GeneratePreparationReportCommand> = {},
): GeneratePreparationReportCommand {
  return {
    agendaDate: AGENDA_DATE_T25,
    order: 'APPOINTMENT_TIME_ASC',
    context: makePrContext(),
    sourceImportId: 'import-pr-t25-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T-25 — INV-PR-005: Tenant isolation a nivel Application
// ---------------------------------------------------------------------------

describe('T-25 Application — INV-PR-005: tenant isolation en GeneratePreparationReport', () => {
  it('listForPrint recibe el TenantContext exacto del command — nunca un tenant externo', async () => {
    const { useCase, preparationListQuery } = makePrMocks();
    await useCase.execute(makePrCommand());

    const [, , tenantPassed] = (preparationListQuery.listForPrint as ReturnType<typeof vi.fn>)
      .mock.calls[0] as unknown[];

    expect(tenantPassed).toStrictEqual(TENANT_PR);
    expect(tenantPassed).not.toStrictEqual(TENANT_OTHER);
  });

  it('context de TENANT_OTHER se propaga correctamente si se cambia el command', async () => {
    const { useCase, preparationListQuery } = makePrMocks();
    await useCase.execute(
      makePrCommand({ context: makePrContext(TENANT_OTHER) }),
    );

    const [, , tenantPassed] = (preparationListQuery.listForPrint as ReturnType<typeof vi.fn>)
      .mock.calls[0] as unknown[];

    expect(tenantPassed).toStrictEqual(TENANT_OTHER);
    expect(tenantPassed).not.toStrictEqual(TENANT_PR);
  });

  it('audit entry lleva el RequestContext completo — tenantId correcto, sin cruce', async () => {
    const { useCase, auditWriter } = makePrMocks();
    await useCase.execute(makePrCommand());

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [
      import('@sigac/audit').AuditEntry,
      RequestContext,
    ][];
    const successCall = calls.find(([e]) => e.result === 'success');
    expect(successCall).toBeDefined();
    const [, ctx] = successCall!;

    expect(ctx.tenant.tenantId).toBe(TENANT_PR.tenantId);
    expect(ctx.tenant.databaseName).toBe(TENANT_PR.databaseName);
    expect(ctx.tenant).not.toStrictEqual(TENANT_OTHER);
  });
});

// ---------------------------------------------------------------------------
// T-25 — INV-PR-008: Audit entry hygiene — sin PII
// ---------------------------------------------------------------------------

describe('T-25 Application — INV-PR-008: audit entry sin PII', () => {
  it('changeSummary de SUCCESS no contiene nombre de paciente, folio ni expediente', async () => {
    const { useCase, auditWriter } = makePrMocks([
      makePrItem({ folio: 'FOLIO-PRIVADO-001', nombrePaciente: 'MARIA SINTETICA' }),
      makePrItem({ folio: 'FOLIO-PRIVADO-002', expediente: { original: 'EXP-PRIVADO-002', reference: null } }),
    ]);
    await useCase.execute(makePrCommand());

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [
      import('@sigac/audit').AuditEntry,
      RequestContext,
    ][];
    const successCall = calls.find(([e]) => e.result === 'success');
    expect(successCall).toBeDefined();
    const [entry] = successCall!;

    const json = JSON.stringify(entry.changeSummary ?? {});

    // PII prohibida en changeSummary (REQ-PR-006 §AC-3)
    expect(json).not.toContain('FOLIO-PRIVADO');
    expect(json).not.toContain('MARIA SINTETICA');
    expect(json).not.toContain('EXP-PRIVADO');
    expect(json).not.toMatch(/curp/i);

    // Campos aprobados presentes (non-PII)
    expect(entry.changeSummary).toHaveProperty('agendaDate');
    expect(entry.changeSummary).toHaveProperty('sourceImportId');
    expect(entry.changeSummary).toHaveProperty('recordCount');
    expect(entry.changeSummary).toHaveProperty('serviceCount');
  });

  it('changeSummary de NOT-FOUND (sin citas) no contiene datos de servicio ni paciente', async () => {
    const { useCase, auditWriter } = makePrMocks([]);
    await useCase.execute(makePrCommand()).catch(() => undefined);

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [
      import('@sigac/audit').AuditEntry,
      RequestContext,
    ][];
    const notFoundCall = calls.find(([e]) => e.result === 'not-found');
    expect(notFoundCall).toBeDefined();
    const [entry] = notFoundCall!;

    const json = JSON.stringify(entry);
    expect(json).not.toMatch(/paciente/i);
    expect(json).not.toMatch(/folio/i);
    expect(json).not.toMatch(/curp/i);
    expect(entry.action).toBe('AGENDA_REPORT_GENERATED');
    expect(entry.resourceType).toBe('AGENDA');
  });

  it('resourceId del audit entry es la fecha de agenda — no un ID de paciente', async () => {
    const { useCase, auditWriter } = makePrMocks();
    await useCase.execute(makePrCommand());

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [
      import('@sigac/audit').AuditEntry,
      RequestContext,
    ][];
    const successCall = calls.find(([e]) => e.result === 'success');
    const [entry] = successCall!;

    // resourceId es la fecha (YYYY-MM-DD), nunca un folio o expediente
    expect(entry.resourceId).toBe('2026-09-15');
    expect(entry.resourceId).not.toMatch(/folio/i);
    expect(entry.resourceId).not.toMatch(/exp/i);
  });
});
