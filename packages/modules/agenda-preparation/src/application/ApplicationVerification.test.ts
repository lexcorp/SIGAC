/**
 * T-08 — Verification suite de Application
 *
 * Covers: idempotency, rollback conceptual, authorization edge cases,
 * RequestContext/TenantContext propagation, and audit privacy.
 */
import type { AuditEntry } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { Agenda } from '../domain/aggregates/Agenda.js';
import { Cita } from '../domain/entities/Cita.js';
import type { CitaSnapshot } from '../domain/entities/Cita.js';
import {
  AgendaFecha,
  FolioCita,
  HoraCita,
  ImportacionAgendaId,
  MedicoReferencia,
  NumeroEmpleado,
  ServicioEspecialidad,
} from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import { GetAgendaDaySummary } from './GetAgendaDaySummary.js';
import { GetAgendaImportIncidents } from './GetAgendaImportIncidents.js';
import { GetAgendaImportResult } from './GetAgendaImportResult.js';
import { GetAgendaPreparationList } from './GetAgendaPreparationList.js';
import { ImportAgenda } from './ImportAgenda.js';
import { ListAgendaImports } from './ListAgendaImports.js';
import { PrintAgendaPreparationList } from './PrintAgendaPreparationList.js';
import type { InterpretedAgendaFile, ParsedAgendaRow } from './ports/AgendaFileInterpreterPort.js';
import type { AgendaPreparationTransaction } from './ports/AgendaPreparationUnitOfWork.js';
import type {
  AgendaDayReadModel,
  AgendaImportHistoryPage,
  AgendaImportIncidentSummary,
  AgendaImportResult,
  PreparationPage,
} from './ports/ReadQueryPorts.js';
import type { ImportEquivalentReference } from './ports/RepositoryPorts.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const tenantA: TenantContext = {
  tenantId: 'tenant-a', slug: 'hospital-a', hospitalId: 'hosp-a',
  databaseName: 'sigac_hosp_a', timezone: 'America/Mexico_City',
};

const tenantB: TenantContext = {
  tenantId: 'tenant-b', slug: 'hospital-b', hospitalId: 'hosp-b',
  databaseName: 'sigac_hosp_b', timezone: 'America/Mexico_City',
};

function makeContext(
  permissions: string[] = ['AGENDA_IMPORT'],
  tenant: TenantContext = tenantA,
  overrides: Partial<Pick<RequestContext, 'requestId' | 'correlationId' | 'source'>> = {},
): RequestContext {
  return {
    actor: {
      actorId: 'actor-001',
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(permissions),
      tenantIds: new Set([tenant.tenantId]),
    },
    tenant,
    requestId: overrides.requestId ?? 'req-001',
    correlationId: overrides.correlationId ?? 'corr-001',
    source: overrides.source ?? 'WEB',
  };
}

const agendaDate = AgendaFecha.parse('2026-08-25');

const medicoResolved = MedicoReferencia.create({
  numeroEmpleado: NumeroEmpleado.parse('12345'),
  nombre: 'DR MEDICO SINTETICO',
});
const servicioDefault = ServicioEspecialidad.create({ codigo: 'CIR', nombre: 'CIRUGIA GENERAL' });

function makeValidRow(folio = 'FOLIO-001', pos = 1): ParsedAgendaRow {
  return {
    sourcePosition: pos,
    originalValues: {
      folio, patientName: 'PACIENTE SINTETICO', expedienteReference: 'PERR810604/10',
      beneficiaryType: 'PENSIONISTA', firstTimeMarker: 'X', subsequentMarker: null,
      agendaDate: '2026-08-25', appointmentTime: '08:00',
      physicianEmployeeNumber: '12345', physicianName: 'DR MEDICO SINTETICO',
      serviceCode: 'CIR', serviceName: 'CIRUGIA GENERAL',
    },
    interpretedValues: {
      folio: FolioCita.parse(folio), agendaFecha: agendaDate, beneficiaryType: 'PENSIONISTA',
      appointmentKind: 'FIRST_TIME', appointmentTime: '08:00',
      numeroEmpleado: NumeroEmpleado.parse('12345'), servicioEspecialidad: servicioDefault,
    },
  };
}

function makeInterpretedFile(rows: ParsedAgendaRow[] = [makeValidRow()], fp = 'fp-abc123'): InterpretedAgendaFile {
  return { fingerprint: { value: fp }, layout: 'SIMEF_V1', agendaDate, rows };
}

const stubFile = { sizeBytes: 512, open: async function* () { yield new Uint8Array(); } };

function makeImportMocks(opts: {
  fingerprintEquivalent?: ImportEquivalentReference | null;
  priorKey?: { importacionId: ImportacionAgendaId } | null;
} = {}) {
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
      findByKey: vi.fn().mockResolvedValue(opts.priorKey ?? null),
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

  const interpreter = {
    inspect: vi.fn().mockResolvedValue({}),
    interpret: vi.fn().mockResolvedValue(makeInterpretedFile()),
  };

  const metadataRepository = {
    findEquivalent: vi.fn().mockResolvedValue(opts.fingerprintEquivalent ?? null),
    associateConfirmedImport: vi.fn().mockResolvedValue(undefined),
  };

  const idempotencyKeyRepository = {
    findByKey: vi.fn().mockResolvedValue(opts.priorKey ?? null),
    recordKey: vi.fn().mockResolvedValue(undefined),
  };

  const useCase = new ImportAgenda({
    interpreter,
    medicoQuery: {
      findByEmployeeNumber: vi.fn().mockResolvedValue({ kind: 'RESOLVED', medico: medicoResolved }),
      findControlledFallback: vi.fn().mockResolvedValue({ kind: 'NOT_FOUND' }),
    },
    expedienteQuery: { resolve: vi.fn().mockResolvedValue([]) },
    metadataRepository,
    idempotencyKeyRepository,
    unitOfWork,
  });

  return { useCase, interpreter, tx, auditWriter, unitOfWork, metadataRepository, idempotencyKeyRepository };
}

// ---------------------------------------------------------------------------
// 1. Idempotency: IDEMPOTENCY_KEY_REUSED
// ---------------------------------------------------------------------------

describe('ImportAgenda — idempotencia Application-level', () => {
  it('lanza IDEMPOTENCY_KEY_REUSED cuando la misma clave se usó con un artefacto diferente', async () => {
    // priorKey exists (key was used before), but no fingerprint equivalent (different content)
    const priorKeyRecord = { importacionId: ImportacionAgendaId.parse('prior-import') };
    const { useCase } = makeImportMocks({ priorKey: priorKeyRecord, fingerprintEquivalent: null });

    const input = {
      importAttemptId: 'attempt-002',
      idempotencyKey: 'key-reused',
      file: stubFile,
      context: makeContext(),
    };

    await expect(useCase.execute(input))
      .rejects.toMatchObject({ name: 'ApplicationError', code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('NO lanza IDEMPOTENCY_KEY_REUSED cuando la misma clave coincide con el mismo artefacto (fingerprint equivalente)', async () => {
    // priorKey exists AND fingerprint equivalent exists — this is the ALREADY_IMPORTED path, not a conflict
    const priorId = ImportacionAgendaId.parse('prior-import');
    const priorKeyRecord = { importacionId: priorId };
    const fingerprintEquivalent: ImportEquivalentReference = {
      importacionId: priorId,
      importedAt: new Date('2026-08-25T09:00:00Z'),
    };
    const { useCase } = makeImportMocks({ priorKey: priorKeyRecord, fingerprintEquivalent });

    const input = {
      importAttemptId: 'attempt-003',
      idempotencyKey: 'key-same-content',
      file: stubFile,
      context: makeContext(),
    };

    const result = await useCase.execute(input);
    expect(result.outcome).toBe('ALREADY_IMPORTED');
  });
});

// ---------------------------------------------------------------------------
// 2. Rollback conceptual: UoW operation throws → error surfaces
// ---------------------------------------------------------------------------

describe('ImportAgenda — rollback conceptual de UnitOfWork', () => {
  it('propaga el error si el repository falla dentro del UoW (rollback es responsabilidad del UoW)', async () => {
    const { useCase, tx } = makeImportMocks();

    // Simulate save failing
    (tx.importacionAgendaRepository.save as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Simulated persistence failure'));

    await expect(useCase.execute({
      importAttemptId: 'attempt-004',
      idempotencyKey: 'key-fail',
      file: stubFile,
      context: makeContext(),
    })).rejects.toThrow('Simulated persistence failure');
  });

  it('no escribe audit success si el repository falla dentro del UoW', async () => {
    const { useCase, tx, auditWriter } = makeImportMocks();

    (tx.importacionAgendaRepository.save as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Persistence error'));

    await useCase.execute({
      importAttemptId: 'attempt-005',
      idempotencyKey: 'key-fail-2',
      file: stubFile,
      context: makeContext(),
    }).catch(() => { /* expected */ });

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'success')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. ImportAttemptId es distinto de RequestContext.requestId
// ---------------------------------------------------------------------------

describe('ImportAgenda — ImportAttemptId vs RequestContext', () => {
  it('el AuditEntry denied usa importAttemptId como resourceId, no requestId', async () => {
    const { useCase, auditWriter } = makeImportMocks();

    await useCase.execute({
      importAttemptId: 'custom-attempt-id',
      idempotencyKey: 'key-001',
      file: stubFile,
      context: makeContext([], tenantA, { requestId: 'req-distinct-001' }),
    }).catch(() => { /* denied throws */ });

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    const deniedCall = calls.find(([e]) => e.result === 'denied');
    expect(deniedCall).toBeDefined();
    expect(deniedCall![0].resourceId).toBe('custom-attempt-id');
    expect(deniedCall![0].resourceId).not.toBe('req-distinct-001');
  });
});

// ---------------------------------------------------------------------------
// 4. Audit privacy: AuditEntry no contiene PII ni datos raw
// ---------------------------------------------------------------------------

describe('ImportAgenda — privacidad del AuditEntry', () => {
  it('el AuditEntry success no contiene nombre de paciente, FOLIO, raw ni datos personales', async () => {
    const { useCase, auditWriter } = makeImportMocks();

    await useCase.execute({
      importAttemptId: 'attempt-priv',
      idempotencyKey: 'key-priv',
      file: stubFile,
      context: makeContext(),
    });

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    const successEntry = calls.find(([e]) => e.result === 'success')?.[0];
    expect(successEntry).toBeDefined();

    // Should not contain patient data or raw row content
    const entryStr = JSON.stringify(successEntry);
    expect(entryStr).not.toMatch(/paciente|patient|nombre|folio|curp|phone|teléfono/i);
    expect(successEntry!.changeSummary).toBeUndefined();

    // Should contain exactly the approved fields
    expect(successEntry!.action).toBe('AGENDA_IMPORT');
    expect(successEntry!.resourceType).toBe('AGENDA_IMPORT');
    expect(typeof successEntry!.resourceId).toBe('string');
    expect(successEntry!.result).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// 5. RequestContext propagation through audit
// ---------------------------------------------------------------------------

describe('ImportAgenda — propagación de RequestContext al auditWriter', () => {
  it('el AuditWriter recibe el RequestContext completo (requestId, correlationId, source, tenant)', async () => {
    const { useCase, auditWriter } = makeImportMocks();

    const ctx = makeContext(['AGENDA_IMPORT'], tenantA, {
      requestId: 'req-ctx-check',
      correlationId: 'corr-ctx-check',
      source: 'WEB',
    });

    await useCase.execute({
      importAttemptId: 'attempt-ctx',
      idempotencyKey: 'key-ctx',
      file: stubFile,
      context: ctx,
    });

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    const successCall = calls.find(([e]) => e.result === 'success');
    expect(successCall).toBeDefined();
    const [, ctxReceived] = successCall!;
    expect(ctxReceived.requestId).toBe('req-ctx-check');
    expect(ctxReceived.correlationId).toBe('corr-ctx-check');
    expect(ctxReceived.source).toBe('WEB');
    expect(ctxReceived.tenant.tenantId).toBe('tenant-a');
    expect(ctxReceived.actor.actorId).toBe('actor-001');
  });
});

// ---------------------------------------------------------------------------
// 6. TenantContext isolation: tenant-a cannot import for tenant-b
// ---------------------------------------------------------------------------

describe('ImportAgenda — TenantContext isolation', () => {
  it('el UoW recibe exclusivamente el tenant del RequestContext — no del input externo', async () => {
    const { useCase, unitOfWork } = makeImportMocks();

    const ctx = makeContext(['AGENDA_IMPORT'], tenantA);
    await useCase.execute({
      importAttemptId: 'attempt-iso',
      idempotencyKey: 'key-iso',
      file: stubFile,
      context: ctx,
    });

    // UoW must be called with tenant from context, not from file/body
    const uowCall = (unitOfWork.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [TenantContext, unknown];
    expect(uowCall[0]).toStrictEqual(tenantA);
    expect(uowCall[0]).not.toStrictEqual(tenantB);
  });
});

// ---------------------------------------------------------------------------
// 7. Authorization: wrong permission class
// ---------------------------------------------------------------------------

describe('autorización — clase de permiso incorrecta', () => {
  it('GetAgendaImportResult rechaza AGENDA_INCIDENT_VIEW (requiere AGENDA_VIEW)', async () => {
    const importResultQuery = { findById: vi.fn().mockResolvedValue(null) };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaImportResult({ importResultQuery, auditWriter });

    await expect(useCase.execute({
      importacionId: ImportacionAgendaId.parse('imp-001'),
      context: makeContext(['AGENDA_INCIDENT_VIEW']),
    })).rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });

    expect(importResultQuery.findById).not.toHaveBeenCalled();
  });

  it('GetAgendaImportIncidents rechaza AGENDA_VIEW (requiere AGENDA_INCIDENT_VIEW)', async () => {
    const incidentsQuery = { findByImportacionId: vi.fn().mockResolvedValue([]) };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaImportIncidents({ incidentsQuery, auditWriter });

    await expect(useCase.execute({
      importacionId: ImportacionAgendaId.parse('imp-001'),
      context: makeContext(['AGENDA_VIEW']),
    })).rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });

    expect(incidentsQuery.findByImportacionId).not.toHaveBeenCalled();
  });

  it('ImportAgenda rechaza AGENDA_VIEW (requiere AGENDA_IMPORT)', async () => {
    const { useCase, auditWriter } = makeImportMocks();

    await expect(useCase.execute({
      importAttemptId: 'attempt-wrong',
      idempotencyKey: 'key-wrong',
      file: stubFile,
      context: makeContext(['AGENDA_VIEW']),
    })).rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });

    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'denied')).toBeDefined();
  });

  it('GetAgendaDaySummary rechaza AGENDA_IMPORT (requiere AGENDA_VIEW)', async () => {
    const dayQuery = { findByDate: vi.fn().mockResolvedValue(null) };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaDaySummary({ dayQuery, auditWriter });

    await expect(useCase.execute({
      agendaDate,
      context: makeContext(['AGENDA_IMPORT']),
    })).rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });

    expect(dayQuery.findByDate).not.toHaveBeenCalled();
  });

  it('GetAgendaPreparationList rechaza AGENDA_INCIDENT_VIEW (requiere AGENDA_VIEW)', async () => {
    const preparationQuery = {
      findPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null } as PreparationPage),
      listForPrint: vi.fn().mockResolvedValue([]),
    };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaPreparationList({ preparationQuery, auditWriter });

    await expect(useCase.execute({
      agendaDate,
      order: 'APPOINTMENT_TIME_ASC',
      pagination: { limit: 10 },
      context: makeContext(['AGENDA_INCIDENT_VIEW']),
    })).rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });

    expect(preparationQuery.findPage).not.toHaveBeenCalled();
  });

  it('PrintAgendaPreparationList rechaza AGENDA_IMPORT (requiere AGENDA_VIEW)', async () => {
    const preparationQuery = {
      findPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null } as PreparationPage),
      listForPrint: vi.fn().mockResolvedValue([]),
    };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new PrintAgendaPreparationList({ preparationQuery, auditWriter });

    await expect(useCase.execute({
      agendaDate,
      order: 'APPOINTMENT_TIME_ASC',
      context: makeContext(['AGENDA_IMPORT']),
    })).rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });

    expect(preparationQuery.listForPrint).not.toHaveBeenCalled();
  });

  it('ListAgendaImports rechaza AGENDA_INCIDENT_VIEW (requiere AGENDA_VIEW)', async () => {
    const historyQuery = {
      findAll: vi.fn().mockResolvedValue({ items: [], nextCursor: null } as AgendaImportHistoryPage),
    };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new ListAgendaImports({ historyQuery, auditWriter });

    await expect(useCase.execute({
      pagination: { limit: 10 },
      context: makeContext(['AGENDA_INCIDENT_VIEW']),
    })).rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });

    expect(historyQuery.findAll).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 8. TenantContext propagation across all query use cases
// ---------------------------------------------------------------------------

describe('propagación de TenantContext en todos los Query Use Cases', () => {
  const importacionId = ImportacionAgendaId.parse('imp-tenant-check');

  it('GetAgendaImportResult usa context.tenant (no un tenant alternativo)', async () => {
    const importResultQuery = {
      findById: vi.fn().mockResolvedValue({
        summary: {
          importacionId: 'imp-tenant-check', agendaDate: '2026-08-25',
          importedAt: new Date(), outcome: 'IMPORTED', metrics: {
            receivedRecords: 0, processed: 0, added: 0, updated: 0, unchanged: 0,
            restored: 0, pendingReview: 0, rejected: 0, duplicateFolio: 0,
            withdrawnFromAgenda: 0, incidents: 0, errors: 0,
          }, hasChanges: false,
        },
        registros: [],
      } as AgendaImportResult),
    };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaImportResult({ importResultQuery, auditWriter });

    await useCase.execute({ importacionId, context: makeContext(['AGENDA_VIEW'], tenantA) });
    expect(importResultQuery.findById).toHaveBeenCalledWith(importacionId, tenantA);
    expect(importResultQuery.findById).not.toHaveBeenCalledWith(importacionId, tenantB);
  });

  it('GetAgendaDaySummary usa context.tenant', async () => {
    const sampleModel: AgendaDayReadModel = {
      agendaDate: '2026-08-25', latestImportacionId: 'imp-001',
      latestImportedAt: new Date(), latestOutcome: 'IMPORTED',
      activeAppointments: 5, physicians: 1, services: 1, incidentCount: 0,
    };
    const dayQuery = { findByDate: vi.fn().mockResolvedValue(sampleModel) };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaDaySummary({ dayQuery, auditWriter });

    await useCase.execute({ agendaDate, context: makeContext(['AGENDA_VIEW'], tenantA) });
    expect(dayQuery.findByDate).toHaveBeenCalledWith(agendaDate, tenantA);
    expect(dayQuery.findByDate).not.toHaveBeenCalledWith(agendaDate, tenantB);
  });

  it('GetAgendaImportIncidents usa context.tenant', async () => {
    const incidentsQuery = {
      findByImportacionId: vi.fn().mockResolvedValue([] as AgendaImportIncidentSummary[]),
    };
    const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new GetAgendaImportIncidents({ incidentsQuery, auditWriter });

    await useCase.execute({ importacionId, context: makeContext(['AGENDA_INCIDENT_VIEW'], tenantA) });
    expect(incidentsQuery.findByImportacionId).toHaveBeenCalledWith(importacionId, tenantA);
    expect(incidentsQuery.findByImportacionId).not.toHaveBeenCalledWith(importacionId, tenantB);
  });
});

// ---------------------------------------------------------------------------
// 9. Reconciliation with full UNCHANGED + WITHDRAWN — metrics equation
// ---------------------------------------------------------------------------

describe('ImportAgenda — reconciliación con Citas sin cambios y retirada', () => {
  it('importación idéntica de Agenda existente produce IMPORTED (no RECONCILED) con unchanged=N', async () => {
    const { useCase, tx } = makeImportMocks();

    const existingSnapshot: CitaSnapshot = {
      folio: FolioCita.parse('FOLIO-001'),
      agendaFecha: agendaDate,
      hora: HoraCita.parse('08:00'), // same as incoming → UNCHANGED
      expedienteReference: null,
      nombrePaciente: 'PACIENTE SINTETICO',
      tipoDerechohabiente: 'PENSIONISTA',
      tipoConsulta: 'FIRST_TIME',
      medico: medicoResolved,
      servicioEspecialidad: servicioDefault,
    };
    const agendaWithCita = Agenda.create({
      fecha: agendaDate,
      citasIniciales: [Cita.create(existingSnapshot)],
    });
    (tx.agendaRepository.findByFecha as ReturnType<typeof vi.fn>).mockResolvedValue(agendaWithCita);

    const result = await useCase.execute({
      importAttemptId: 'attempt-unch',
      idempotencyKey: 'key-unch',
      file: stubFile,
      context: makeContext(),
    });

    // Agenda pre-existed but no changes → IMPORTED (not RECONCILED)
    expect(result.outcome).toBe('IMPORTED');
    expect(result.metrics.unchanged).toBe(1);
    expect(result.metrics.added).toBe(0);
    expect(result.metrics.updated).toBe(0);
    // Metrics equation: receivedRecords = processed + pendingReview + rejected + duplicateFolio
    expect(result.metrics.receivedRecords).toBe(
      result.metrics.processed +
      result.metrics.pendingReview +
      result.metrics.rejected +
      result.metrics.duplicateFolio,
    );
  });
});
