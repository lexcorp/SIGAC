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
