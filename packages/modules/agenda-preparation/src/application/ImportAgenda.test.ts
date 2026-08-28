import type { AuditEntry } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { Agenda } from '../domain/aggregates/Agenda.js';
import { Cita, type CitaSnapshot } from '../domain/entities/Cita.js';
import { IncidenciaImportacion } from '../domain/entities/IncidenciaImportacion.js';
import {
  AgendaFecha,
  ExpedienteReferencia,
  FolioCita,
  HoraCita,
  ImportacionAgendaId,
  MedicoReferencia,
  NumeroEmpleado,
  ServicioEspecialidad,
} from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import { ImportAgenda, LayoutRejectedError } from './ImportAgenda.js';
import type { InterpretedAgendaFile, ParsedAgendaRow } from './ports/AgendaFileInterpreterPort.js';
import type { AgendaPreparationTransaction } from './ports/AgendaPreparationUnitOfWork.js';
import type { ImportEquivalentReference } from './ports/RepositoryPorts.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const tenant: TenantContext = {
  tenantId: 'tenant-a',
  slug: 'hospital-a',
  hospitalId: 'hosp-a',
  databaseName: 'sigac_hosp_a',
  timezone: 'America/Mexico_City',
};

function makeContext(permissions: string[] = ['AGENDA_IMPORT']): RequestContext {
  return {
    actor: {
      actorId: 'actor-001',
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(permissions),
      tenantIds: new Set(['tenant-a']),
    },
    tenant,
    requestId: 'req-001',
    correlationId: 'corr-001',
    source: 'WEB',
  };
}

const stubFile = {
  sizeBytes: 512,
  open: async function* () { yield new Uint8Array(); },
};

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
      folio,
      patientName: 'PACIENTE SINTETICO',
      expedienteReference: 'PERR810604/10',
      beneficiaryType: 'PENSIONISTA',
      firstTimeMarker: 'X',
      subsequentMarker: null,
      agendaDate: '2026-08-25',
      appointmentTime: '08:00',
      physicianEmployeeNumber: '12345',
      physicianName: 'DR MEDICO SINTETICO',
      serviceCode: 'CIR',
      serviceName: 'CIRUGIA GENERAL',
    },
    interpretedValues: {
      folio: FolioCita.parse(folio),
      agendaFecha: agendaDate,
      beneficiaryType: 'PENSIONISTA',
      appointmentKind: 'FIRST_TIME',
      appointmentTime: '08:00',
      numeroEmpleado: NumeroEmpleado.parse('12345'),
      servicioEspecialidad: servicioDefault,
    },
  };
}

function makeInterpretedFile(rows: ParsedAgendaRow[] = [makeValidRow()]): InterpretedAgendaFile {
  return {
    fingerprint: { value: 'fp-abc123' },
    layout: 'SIMEF_V1',
    agendaDate,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeMocks() {
  const auditWriter = {
    append: vi.fn().mockResolvedValue(undefined),
  };

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
      async (_tenant: TenantContext, operation: (t: AgendaPreparationTransaction) => Promise<unknown>) =>
        operation(tx),
    ),
  };

  const interpreter = {
    inspect: vi.fn().mockResolvedValue({}),
    interpret: vi.fn().mockResolvedValue(makeInterpretedFile()),
  };

  const medicoQuery = {
    findByEmployeeNumber: vi.fn().mockResolvedValue({ kind: 'RESOLVED', medico: medicoResolved }),
    findControlledFallback: vi.fn().mockResolvedValue({ kind: 'NOT_FOUND' }),
  };

  const expedienteQuery = {
    resolve: vi.fn().mockResolvedValue([
      { reference: ExpedienteReferencia.parse('PERR810604/10') },
    ]),
  };

  const metadataRepository = {
    findEquivalent: vi.fn().mockResolvedValue(null),
    associateConfirmedImport: vi.fn().mockResolvedValue(undefined),
  };

  const idempotencyKeyRepository = {
    findByKey: vi.fn().mockResolvedValue(null),
    recordKey: vi.fn().mockResolvedValue(undefined),
  };

  const useCase = new ImportAgenda({
    interpreter,
    medicoQuery,
    expedienteQuery,
    metadataRepository,
    idempotencyKeyRepository,
    unitOfWork,
  });

  return {
    useCase, interpreter, medicoQuery, expedienteQuery, metadataRepository,
    idempotencyKeyRepository, unitOfWork, tx, auditWriter,
  };
}

function makeInput(overrides: Partial<{ permissions: string[]; idempotencyKey: string }> = {}) {
  return {
    importAttemptId: 'attempt-001',
    idempotencyKey: overrides.idempotencyKey ?? 'key-001',
    file: stubFile,
    context: makeContext(overrides.permissions),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportAgenda', () => {

  // -------------------------------------------------------------------------
  // Test 1: archivo válido — primera importación (IMPORTED)
  // -------------------------------------------------------------------------
  describe('cuando el archivo es válido y no hay importación previa', () => {
    it('devuelve outcome=IMPORTED con métricas correctas y escribe audit success', async () => {
      const { useCase, tx, auditWriter } = makeMocks();

      const result = await useCase.execute(makeInput());

      expect(result.outcome).toBe('IMPORTED');
      expect(result.agendaDate).toBe('2026-08-25');
      expect(result.metrics.receivedRecords).toBe(1);
      expect(result.metrics.added).toBe(1);
      expect(result.metrics.updated).toBe(0);
      expect(result.metrics.errors).toBe(0);
      expect(result.hasChanges).toBe(true);
      expect(typeof result.importacionId).toBe('string');

      // Audit success must be written
      const successCall = (auditWriter.append as Mock).mock.calls.find(
        (args) => (args[0] as AuditEntry).result === 'success',
      );
      expect(successCall).toBeDefined();
      const [entry, ctx] = successCall as [AuditEntry, RequestContext];
      expect(entry.action).toBe('AGENDA_IMPORT');
      expect(entry.resourceType).toBe('AGENDA_IMPORT');
      expect(entry.result).toBe('success');
      expect(ctx.tenant.tenantId).toBe('tenant-a');

      // Repos persisted
      expect((tx.importacionAgendaRepository.save as Mock).mock.calls).toHaveLength(1);
      expect((tx.agendaRepository.save as Mock).mock.calls).toHaveLength(1);
      expect(
        (tx.importArtifactMetadataRepository.associateConfirmedImport as Mock).mock.calls,
      ).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: layout inválido — LayoutRejectedError, sin audit
  // -------------------------------------------------------------------------
  describe('cuando el intérprete rechaza el archivo', () => {
    it('lanza LayoutRejectedError y NO escribe ningún AuditEntry', async () => {
      const { useCase, interpreter, auditWriter } = makeMocks();
      (interpreter.interpret as Mock).mockRejectedValue(new Error('Formato desconocido'));

      await expect(useCase.execute(makeInput())).rejects.toThrow(LayoutRejectedError);

      // No success or denied audit entries (layout rejection is pre-domain, no audit)
      const auditCalls = (auditWriter.append as Mock).mock.calls as [AuditEntry, RequestContext][];
      const relevantCalls = auditCalls.filter(
        ([entry]) => entry.result === 'success' || entry.result === 'denied',
      );
      expect(relevantCalls).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Test 3: reimportación idéntica — ALREADY_IMPORTED
  // -------------------------------------------------------------------------
  describe('cuando la huella del archivo ya existe en metadata', () => {
    it('devuelve outcome=ALREADY_IMPORTED sin crear nueva ImportacionAgenda', async () => {
      const { useCase, metadataRepository, unitOfWork } = makeMocks();

      const priorId = ImportacionAgendaId.parse('prior-import-id');
      (metadataRepository.findEquivalent as Mock).mockResolvedValue({
        importacionId: priorId,
        importedAt: new Date('2026-08-25T09:00:00Z'),
      } satisfies ImportEquivalentReference);

      const result = await useCase.execute(makeInput());

      expect(result.outcome).toBe('ALREADY_IMPORTED');
      expect(result.importacionId).toBe('prior-import-id');
      expect(result.hasChanges).toBe(false);

      // UoW must NOT be called for domain writes when already-imported returns early
      expect((unitOfWork.execute as Mock).mock.calls).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Test 4: reconciliación con cambios — RECONCILED
  // -------------------------------------------------------------------------
  describe('cuando la Agenda ya existe y el archivo trae una Cita con hora diferente', () => {
    it('devuelve outcome=RECONCILED con la Cita actualizada', async () => {
      const { useCase, tx } = makeMocks();

      // Build a pre-existing Agenda with FOLIO-001 at 07:00
      const existingCitaSnapshot: CitaSnapshot = {
        folio: FolioCita.parse('FOLIO-001'),
        agendaFecha: agendaDate,
        hora: HoraCita.parse('07:00'), // incoming will be 08:00 → UPDATE
        expedienteReference: null,
        nombrePaciente: 'PACIENTE SINTETICO',
        tipoDerechohabiente: 'PENSIONISTA',
        tipoConsulta: 'FIRST_TIME',
        medico: medicoResolved,
        servicioEspecialidad: servicioDefault,
      };
      const agendaWithCita = Agenda.create({
        fecha: agendaDate,
        citasIniciales: [Cita.create(existingCitaSnapshot)],
      });

      (tx.agendaRepository.findByFecha as Mock).mockResolvedValue(agendaWithCita);

      const result = await useCase.execute(makeInput());

      expect(result.outcome).toBe('RECONCILED');
      expect(result.metrics.updated).toBe(1);
      expect(result.hasChanges).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: médico NOT_FOUND → PENDING_REVIEW + PHYSICIAN_NOT_RESOLVED
  // -------------------------------------------------------------------------
  describe('cuando el médico no se puede resolver', () => {
    it('produce PENDING_REVIEW con incidencia PHYSICIAN_NOT_RESOLVED', async () => {
      const { useCase, medicoQuery, tx } = makeMocks();

      (medicoQuery.findByEmployeeNumber as Mock).mockResolvedValue({ kind: 'NOT_FOUND' });
      (medicoQuery.findControlledFallback as Mock).mockResolvedValue({ kind: 'NOT_FOUND' });

      const result = await useCase.execute(makeInput());

      expect(result.outcome).toBe('IMPORTED');
      expect(result.metrics.pendingReview).toBe(1);
      expect(result.metrics.added).toBe(0);

      const savedImportacion = (tx.importacionAgendaRepository.save as Mock).mock.calls[0]?.[0];
      expect(savedImportacion).toBeDefined();
      const incidencias = savedImportacion.incidencias as IncidenciaImportacion[];
      expect(incidencias.some(i => i.type === 'PHYSICIAN_NOT_RESOLVED')).toBe(true);
    });
  });

  describe('fallback controlado del nombre de médico', () => {
    it('conserva orig_physician_name en la Cita cuando el número no existe en el catálogo', async () => {
      const mocks = makeMocks();
      const numeroEmpleado = NumeroEmpleado.parse('00437054');
      const nombreReal = 'GALVAN DOMINGUEZ MANUEL ALEJANDRO';
      const row = makeValidRow('FOLIO-MEDICO-REAL', 1);

      mocks.interpreter.interpret.mockResolvedValue(makeInterpretedFile([{
        ...row,
        originalValues: {
          ...row.originalValues,
          physicianEmployeeNumber: numeroEmpleado.value,
          physicianName: nombreReal,
        },
        interpretedValues: {
          ...row.interpretedValues,
          numeroEmpleado,
        },
      }]));
      mocks.medicoQuery.findByEmployeeNumber.mockResolvedValue({ kind: 'NOT_FOUND' });
      mocks.medicoQuery.findControlledFallback.mockResolvedValue({
        kind: 'RESOLVED',
        medico: MedicoReferencia.create({ numeroEmpleado, nombre: nombreReal }),
      });

      await mocks.useCase.execute(makeInput({ idempotencyKey: 'key-medico-real' }));

      expect(mocks.medicoQuery.findByEmployeeNumber).toHaveBeenCalledWith(numeroEmpleado, tenant);
      expect(mocks.medicoQuery.findControlledFallback).toHaveBeenCalledWith(nombreReal, tenant);
      const savedAgenda = (mocks.tx.agendaRepository.save as Mock).mock.calls[0]?.[0] as Agenda;
      expect(savedAgenda.citas[0]?.medico.nombre).toBe(nombreReal);
      expect(savedAgenda.citas[0]?.medico.nombre).not.toBe('MÉDICO 00437054');
      expect(savedAgenda.citas[0]?.medico.numeroEmpleado.value).toBe('00437054');
    });

    it('sin orig_physician_name queda PENDING_REVIEW y no ejecuta fallback ni inventa nombre', async () => {
      const mocks = makeMocks();
      const row = makeValidRow('FOLIO-SIN-NOMBRE', 1);

      mocks.interpreter.interpret.mockResolvedValue(makeInterpretedFile([{
        ...row,
        originalValues: { ...row.originalValues, physicianName: null },
      }]));
      mocks.medicoQuery.findByEmployeeNumber.mockResolvedValue({ kind: 'NOT_FOUND' });

      const result = await mocks.useCase.execute(makeInput({ idempotencyKey: 'key-sin-nombre' }));

      expect(result.metrics.pendingReview).toBe(1);
      expect(mocks.medicoQuery.findControlledFallback).not.toHaveBeenCalled();
      const savedAgenda = (mocks.tx.agendaRepository.save as Mock).mock.calls[0]?.[0] as Agenda;
      expect(savedAgenda.citas).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Test 6: médico AMBIGUOUS en fallback → PENDING_REVIEW + PHYSICIAN_AMBIGUOUS
  // -------------------------------------------------------------------------
  describe('cuando el médico es ambiguo en la resolución por nombre', () => {
    it('produce PENDING_REVIEW con incidencia PHYSICIAN_AMBIGUOUS', async () => {
      const { useCase, medicoQuery, tx } = makeMocks();

      (medicoQuery.findByEmployeeNumber as Mock).mockResolvedValue({ kind: 'NOT_FOUND' });
      (medicoQuery.findControlledFallback as Mock).mockResolvedValue({ kind: 'AMBIGUOUS' });

      const result = await useCase.execute(makeInput());

      expect(result.metrics.pendingReview).toBe(1);

      const savedImportacion = (tx.importacionAgendaRepository.save as Mock).mock.calls[0]?.[0];
      expect(savedImportacion).toBeDefined();
      const incidencias = savedImportacion.incidencias as IncidenciaImportacion[];
      expect(incidencias.some(i => i.type === 'PHYSICIAN_AMBIGUOUS')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Test 7: Expediente 0 matches → null reference, fila procesada como ADDED
  // -------------------------------------------------------------------------
  describe('cuando el Expediente no se encuentra (0 matches)', () => {
    it('procesa la fila con expedienteReference=null y la Cita se agrega como ADDED', async () => {
      const { useCase, expedienteQuery } = makeMocks();

      (expedienteQuery.resolve as Mock).mockResolvedValue([]);

      const result = await useCase.execute(makeInput());

      expect(result.outcome).toBe('IMPORTED');
      expect(result.metrics.added).toBe(1);
      expect(result.metrics.errors).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Test 8: tenant propagation
  // -------------------------------------------------------------------------
  describe('tenant propagation', () => {
    it('propaga el tenant correcto a todos los puertos', async () => {
      const {
        useCase, medicoQuery, expedienteQuery, metadataRepository,
        idempotencyKeyRepository, unitOfWork,
      } = makeMocks();

      await useCase.execute(makeInput());

      // metadataRepository.findEquivalent called with correct tenant
      const metaCall = (metadataRepository.findEquivalent as Mock).mock.calls[0] as unknown[];
      expect(metaCall[1]).toStrictEqual(tenant);

      // idempotencyKeyRepository.findByKey called with correct tenant
      const idemCall = (idempotencyKeyRepository.findByKey as Mock).mock.calls[0] as unknown[];
      expect(idemCall[1]).toStrictEqual(tenant);

      // medicoQuery called with correct tenant
      const medicoCall = (medicoQuery.findByEmployeeNumber as Mock).mock.calls[0] as unknown[];
      expect(medicoCall[1]).toStrictEqual(tenant);

      // expedienteQuery called with correct tenant
      const expCall = (expedienteQuery.resolve as Mock).mock.calls[0] as unknown[];
      expect(expCall[1]).toStrictEqual(tenant);

      // unitOfWork.execute called with correct tenant
      const uowCall = (unitOfWork.execute as Mock).mock.calls[0] as unknown[];
      expect(uowCall[0]).toStrictEqual(tenant);
    });
  });

  // -------------------------------------------------------------------------
  // Test 9: permiso denegado → audit denied, lanza PERMISSION_DENIED
  // -------------------------------------------------------------------------
  describe('cuando el actor no tiene el permiso AGENDA_IMPORT', () => {
    it('escribe AuditEntry denied y lanza ApplicationError PERMISSION_DENIED', async () => {
      const { useCase, interpreter, auditWriter } = makeMocks();
      const inputNoPerm = makeInput({ permissions: [] });

      const err = await useCase.execute(inputNoPerm).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApplicationError);
      expect((err as ApplicationError).code).toBe('PERMISSION_DENIED');

      // The interpreter must NOT have been called
      expect((interpreter.interpret as Mock).mock.calls).toHaveLength(0);

      // Audit denied entry must have been written
      const auditCalls = (auditWriter.append as Mock).mock.calls as [AuditEntry, RequestContext][];
      const deniedCalls = auditCalls.filter(([entry]) => entry.result === 'denied');
      expect(deniedCalls).toHaveLength(1);
      const [deniedEntry] = deniedCalls[0];
      expect(deniedEntry.action).toBe('AGENDA_IMPORT');
      expect(deniedEntry.resourceType).toBe('AGENDA_IMPORT_ATTEMPT');
      expect(deniedEntry.resourceId).toBe('attempt-001');
    });
  });
});

// =============================================================================
// BUG-2 regression: ALREADY_IMPORTED metrics invariant
// =============================================================================
// Root cause: the ALREADY_IMPORTED path previously set receivedRecords to
// interpreted.rows.length (e.g., 411) while all other counters were 0,
// violating the domain invariant:
//   receivedRecords = processed + pendingReview + rejected + duplicateFolio
//
// Fix: all counters are 0 for ALREADY_IMPORTED — no records were processed
// in this attempt. The caller can retrieve the original import's metrics
// via GET /agenda-imports/{importacionId}.
// =============================================================================

describe('BUG-2 regression — ALREADY_IMPORTED metrics invariant', () => {
  it('BUG-2: ALREADY_IMPORTED metrics all zero — receivedRecords = 0', async () => {
    const { useCase, metadataRepository } = makeMocks();
    const priorId = ImportacionAgendaId.parse('88ec5220-cac3-47ef-91e2-502d24d27d2d');
    (metadataRepository.findEquivalent as Mock).mockResolvedValue({
      importacionId: priorId,
      importedAt: new Date('2026-08-24T04:18:47.277Z'),
    } satisfies ImportEquivalentReference);

    const result = await useCase.execute(makeInput());
    const m = result.metrics;

    // All metrics must be zero — no records were processed in this attempt
    expect(m.receivedRecords).toBe(0);
    expect(m.processed).toBe(0);
    expect(m.added).toBe(0);
    expect(m.updated).toBe(0);
    expect(m.unchanged).toBe(0);
    expect(m.restored).toBe(0);
    expect(m.pendingReview).toBe(0);
    expect(m.rejected).toBe(0);
    expect(m.duplicateFolio).toBe(0);
    expect(m.withdrawnFromAgenda).toBe(0);
    expect(m.incidents).toBe(0);
    expect(m.errors).toBe(0);
  });

  it('BUG-2: ALREADY_IMPORTED satisfies receivedRecords = processed + pendingReview + rejected + duplicateFolio', async () => {
    const { useCase, metadataRepository } = makeMocks();
    (metadataRepository.findEquivalent as Mock).mockResolvedValue({
      importacionId: ImportacionAgendaId.parse('prior-invariant-check'),
      importedAt: new Date('2026-08-24T04:00:00Z'),
    } satisfies ImportEquivalentReference);

    const result = await useCase.execute(makeInput());
    const m = result.metrics;

    expect(m.receivedRecords).toBe(
      m.processed + m.pendingReview + m.rejected + m.duplicateFolio,
    );
  });

  it('BUG-2: ALREADY_IMPORTED satisfies processed = added + updated + unchanged + restored', async () => {
    const { useCase, metadataRepository } = makeMocks();
    (metadataRepository.findEquivalent as Mock).mockResolvedValue({
      importacionId: ImportacionAgendaId.parse('prior-processed-check'),
      importedAt: new Date('2026-08-24T04:00:00Z'),
    } satisfies ImportEquivalentReference);

    const result = await useCase.execute(makeInput());
    const m = result.metrics;

    expect(m.processed).toBe(m.added + m.updated + m.unchanged + m.restored);
  });

  it('BUG-2: ALREADY_IMPORTED satisfies errors = rejected + duplicateFolio', async () => {
    const { useCase, metadataRepository } = makeMocks();
    (metadataRepository.findEquivalent as Mock).mockResolvedValue({
      importacionId: ImportacionAgendaId.parse('prior-errors-check'),
      importedAt: new Date('2026-08-24T04:00:00Z'),
    } satisfies ImportEquivalentReference);

    const result = await useCase.execute(makeInput());
    const m = result.metrics;

    expect(m.errors).toBe(m.rejected + m.duplicateFolio);
  });

  it('BUG-2: ALREADY_IMPORTED returns the PRIOR importacionId (not a new one)', async () => {
    const { useCase, metadataRepository, unitOfWork } = makeMocks();
    const equivalentId = '88ec5220-cac3-47ef-91e2-502d24d27d2d';
    (metadataRepository.findEquivalent as Mock).mockResolvedValue({
      importacionId: ImportacionAgendaId.parse(equivalentId),
      importedAt: new Date('2026-08-24T04:18:47Z'),
    } satisfies ImportEquivalentReference);

    const result = await useCase.execute(makeInput());

    // The returned ID must be the PRIOR equivalent import's ID
    expect(result.importacionId).toBe(equivalentId);
    expect(result.outcome).toBe('ALREADY_IMPORTED');
    // No new ImportacionAgenda was created (UoW not called)
    expect((unitOfWork.execute as Mock).mock.calls).toHaveLength(0);
  });

  it('BUG-2: ALREADY_IMPORTED receivedRecords is NOT the number of rows in the file', async () => {
    // This is the direct regression test for the original bug:
    // before the fix, receivedRecords = interpreted.rows.length (e.g. 411)
    // after the fix, receivedRecords = 0
    const { useCase, metadataRepository, interpreter } = makeMocks();

    // Simulate 411 rows in the interpreted file (as in the real smoke test)
    const manyRows = Array.from({ length: 411 }, (_, i) => makeValidRow(`FOLIO-${i}`, i + 1));
    (interpreter.interpret as Mock).mockResolvedValue(makeInterpretedFile(manyRows));
    (metadataRepository.findEquivalent as Mock).mockResolvedValue({
      importacionId: ImportacionAgendaId.parse('prior-with-411-rows'),
      importedAt: new Date('2026-08-24T04:18:47Z'),
    } satisfies ImportEquivalentReference);

    const result = await useCase.execute(makeInput());

    // receivedRecords must be 0, NOT 411
    expect(result.metrics.receivedRecords).toBe(0);
    expect(result.metrics.receivedRecords).not.toBe(411);
    expect(result.outcome).toBe('ALREADY_IMPORTED');
  });
});

// ---------------------------------------------------------------------------
// BUG-REIMPORT regression — fingerprint only registered when no rejected/pending
//
// Root cause: associateConfirmedImport() was called unconditionally, so an
// import that produced only REJECTED records permanently blocked reimportation
// of the same artifact (fingerprint found → ALREADY_IMPORTED on every retry).
//
// Fix: fingerprint is only registered when rejected=0 AND pendingReview=0.
// ---------------------------------------------------------------------------

// Helper: make a row that is missing required data (will be REJECTED)
function makeRejectedRow(folio = 'FOLIO-REJ', pos = 1): ParsedAgendaRow {
  return {
    sourcePosition: pos,
    originalValues: {
      folio,
      patientName: null,
      expedienteReference: null,
      beneficiaryType: null,
      firstTimeMarker: null,
      subsequentMarker: null,
      agendaDate: null,
      appointmentTime: null,
      physicianEmployeeNumber: null,
      physicianName: null,
      serviceCode: null,
      serviceName: null,
    },
    interpretedValues: {
      folio: null,           // missing → REQUIRED_DATA_MISSING → REJECTED
      agendaFecha: null,
      beneficiaryType: null,
      appointmentKind: null,
      appointmentTime: null,
      numeroEmpleado: null,
      servicioEspecialidad: null,
    },
  };
}

describe('BUG-REIMPORT — fingerprint registration gated on zero rejected/pending', () => {

  // ── Case A: 100% successful → reimportation returns ALREADY_IMPORTED ───────

  it('Case A: 100% successful import registers fingerprint — reimport returns ALREADY_IMPORTED', async () => {
    const { useCase, metadataRepository, tx } = makeMocks();

    // First import: 1 valid row → succeeds
    const result1 = await useCase.execute(makeInput({ idempotencyKey: 'key-a1' }));
    expect(result1.outcome).toBe('IMPORTED');

    // associateConfirmedImport WAS called (no rejections)
    expect(
      (tx.importArtifactMetadataRepository.associateConfirmedImport as ReturnType<typeof vi.fn>)
        .mock.calls.length,
    ).toBe(1);

    // Second import: fingerprint found → ALREADY_IMPORTED
    metadataRepository.findEquivalent.mockResolvedValue({
      importacionId: ImportacionAgendaId.parse('88ec5220-0000-4000-8000-000000000001'),
      agendaDate,
      fingerprint: { value: 'fp-abc123' },
    });
    const result2 = await useCase.execute(makeInput({ idempotencyKey: 'key-a2' }));
    expect(result2.outcome).toBe('ALREADY_IMPORTED');
    expect(result2.metrics.receivedRecords).toBe(0);
  });

  // ── Case B: 100% rejected → fingerprint NOT registered → reimportable ──────

  it('Case B: 100% rejected import does NOT register fingerprint', async () => {
    const { useCase, tx } = makeMocks();

    // Override interpreter to return only a rejected row
    const mocks = makeMocks();
    mocks.interpreter.interpret.mockResolvedValue({
      fingerprint: { value: 'fp-all-rejected' },
      layout: 'SIMEF_V1' as const,
      agendaDate,
      rows: [makeRejectedRow('REJ-001', 1)],
    });

    const result = await mocks.useCase.execute(makeInput({ idempotencyKey: 'key-b1' }));

    // Import runs to completion
    expect(result.outcome).toBe('IMPORTED');
    expect(result.metrics.rejected).toBe(1);
    expect(result.metrics.added).toBe(0);

    // fingerprint must NOT be registered
    expect(
      (mocks.tx.importArtifactMetadataRepository.associateConfirmedImport as ReturnType<typeof vi.fn>)
        .mock.calls.length,
    ).toBe(0);
    void tx; // suppress lint
  });

  it('Case B: after all-rejected import, same file can be reimported (no ALREADY_IMPORTED)', async () => {
    const mocks = makeMocks();
    mocks.interpreter.interpret.mockResolvedValue({
      fingerprint: { value: 'fp-all-rejected-b2' },
      layout: 'SIMEF_V1' as const,
      agendaDate,
      rows: [makeRejectedRow('REJ-002', 1)],
    });

    // First import: all rejected, fingerprint NOT registered
    await mocks.useCase.execute(makeInput({ idempotencyKey: 'key-b2-first' }));

    // metadataRepository.findEquivalent remains null (fingerprint not persisted)
    // → second import proceeds normally (not ALREADY_IMPORTED)
    const result2 = await mocks.useCase.execute(makeInput({ idempotencyKey: 'key-b2-second' }));
    expect(result2.outcome).not.toBe('ALREADY_IMPORTED');
    expect(result2.metrics.rejected).toBe(1); // still rejected (parser not fixed yet)
  });

  // ── Case C: partial (200 OK + 50 rejected) → fingerprint NOT registered ───

  it('Case C: partial import (some rejected) does NOT register fingerprint', async () => {
    const mocks = makeMocks();

    // 2 valid + 1 rejected rows
    mocks.interpreter.interpret.mockResolvedValue({
      fingerprint: { value: 'fp-partial' },
      layout: 'SIMEF_V1' as const,
      agendaDate,
      rows: [
        makeValidRow('VALID-001', 1),
        makeValidRow('VALID-002', 2),
        makeRejectedRow('REJ-003', 3),
      ],
    });

    const result = await mocks.useCase.execute(makeInput({ idempotencyKey: 'key-c1' }));

    expect(result.metrics.added).toBe(2);
    expect(result.metrics.rejected).toBe(1);

    // fingerprint NOT registered because rejected > 0
    expect(
      (mocks.tx.importArtifactMetadataRepository.associateConfirmedImport as ReturnType<typeof vi.fn>)
        .mock.calls.length,
    ).toBe(0);
  });

  // ── Case C+: reimport partial → successful rows UNCHANGED, rejected reprocesable

  it('Case C+: reimport of partial file — previously successful rows are UNCHANGED, rejected can recover', async () => {
    const mocks = makeMocks();

    const fp = 'fp-partial-reprocess';

    // Simulate Agenda with existing citas for VALID-001 and VALID-002
    const existingAgenda = Agenda.create({
      fecha: agendaDate,
      citasIniciales: [
        Cita.create({
          folio: FolioCita.parse('VALID-001'),
          agendaFecha: agendaDate,
          hora: HoraCita.parse('08:00'),
          expedienteReference: null,
          nombrePaciente: 'PACIENTE SINTETICO',
          tipoDerechohabiente: 'PENSIONISTA',
          tipoConsulta: 'FIRST_TIME',
          medico: medicoResolved,
          servicioEspecialidad: servicioDefault,
        }),
        Cita.create({
          folio: FolioCita.parse('VALID-002'),
          agendaFecha: agendaDate,
          hora: HoraCita.parse('08:00'),
          expedienteReference: null,
          nombrePaciente: 'PACIENTE SINTETICO',
          tipoDerechohabiente: 'PENSIONISTA',
          tipoConsulta: 'FIRST_TIME',
          medico: medicoResolved,
          servicioEspecialidad: servicioDefault,
        }),
      ],
    });
    // Simulate: agenda already exists with VALID-001 and VALID-002 from the first import
    mocks.tx.agendaRepository.findByFecha = vi.fn().mockResolvedValue(existingAgenda);

    // Second import: all 3 rows (same file) — parser now fixes REJ-003
    mocks.interpreter.interpret.mockResolvedValue({
      fingerprint: { value: fp },
      layout: 'SIMEF_V1' as const,
      agendaDate,
      rows: [
        makeValidRow('VALID-001', 1),
        makeValidRow('VALID-002', 2),
        makeValidRow('REJ-003', 3),   // formerly rejected, now valid after parser fix
      ],
    });

    const result = await mocks.useCase.execute(makeInput({ idempotencyKey: 'key-c-plus' }));

    // VALID-001 and VALID-002 must NOT be re-added.
    // They may show as UPDATED (expedienteReference resolved to a real object
    // while the existing citas were seeded with null reference) — either
    // UNCHANGED or UPDATED is correct; what matters is they are NOT re-ADDED.
    expect(result.metrics.added).toBe(1);   // only REJ-003 (now valid) is new
    expect(result.metrics.added + result.metrics.unchanged + result.metrics.updated).toBe(3); // all 3 accounted
    expect(result.metrics.added).not.toBe(3); // VALID-001 / VALID-002 not re-added
    expect(result.metrics.rejected).toBe(0);
  });

  // ── Case D: parser corrected → all valid → fingerprint registered ─────────

  it('Case D: after parser fix all records valid → fingerprint IS registered', async () => {
    const mocks = makeMocks();

    mocks.interpreter.interpret.mockResolvedValue({
      fingerprint: { value: 'fp-now-all-valid' },
      layout: 'SIMEF_V1' as const,
      agendaDate,
      rows: [makeValidRow('NOW-VALID-001', 1)],
    });

    const result = await mocks.useCase.execute(makeInput({ idempotencyKey: 'key-d1' }));

    expect(result.metrics.rejected).toBe(0);
    expect(result.metrics.pendingReview).toBe(0);

    // fingerprint IS registered when no rejections
    expect(
      (mocks.tx.importArtifactMetadataRepository.associateConfirmedImport as ReturnType<typeof vi.fn>)
        .mock.calls.length,
    ).toBe(1);
  });

  // ── Case E: after D, same file → ALREADY_IMPORTED ─────────────────────────

  it('Case E: after fully successful import, same file returns ALREADY_IMPORTED', async () => {
    const mocks = makeMocks();

    // Simulate fingerprint already registered from Case D
    mocks.metadataRepository.findEquivalent.mockResolvedValue({
      importacionId: ImportacionAgendaId.parse('88ec5220-0000-4000-8000-000000000099'),
      agendaDate,
      fingerprint: { value: 'fp-now-all-valid' },
    });

    const result = await mocks.useCase.execute(makeInput({ idempotencyKey: 'key-e1' }));

    expect(result.outcome).toBe('ALREADY_IMPORTED');
    expect(result.metrics.receivedRecords).toBe(0); // no rows processed
  });

  // ── Regression: pendingReview also blocks fingerprint registration ─────────

  it('Regression: pendingReview > 0 also prevents fingerprint registration', async () => {
    const mocks = makeMocks();

    // Médico not resolved → PENDING_REVIEW
    mocks.medicoQuery.findByEmployeeNumber.mockResolvedValue({ kind: 'NOT_FOUND' });
    mocks.medicoQuery.findControlledFallback.mockResolvedValue({ kind: 'NOT_FOUND' });

    const result = await mocks.useCase.execute(makeInput({ idempotencyKey: 'key-pending' }));

    expect(result.metrics.pendingReview).toBeGreaterThan(0);

    // fingerprint NOT registered
    expect(
      (mocks.tx.importArtifactMetadataRepository.associateConfirmedImport as ReturnType<typeof vi.fn>)
        .mock.calls.length,
    ).toBe(0);
  });
});
