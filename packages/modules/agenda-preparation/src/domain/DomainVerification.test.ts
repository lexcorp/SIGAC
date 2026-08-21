import { describe, expect, it } from 'vitest';
import { Agenda, ImportacionAgenda } from './aggregates/index.js';
import {
  Cita,
  IncidenciaImportacion,
  RegistroImportadoAgenda,
  type CitaSnapshot,
} from './entities/index.js';
import {
  IMPORT_INCIDENTS,
  IMPORT_OUTCOMES,
  RECORD_PROCESSING_RESULTS,
  type ImportIncident,
  type RecordProcessingResult,
} from './types/index.js';
import {
  AgendaFecha,
  ExpedienteReferencia,
  FolioCita,
  HoraCita,
  ImportacionAgendaId,
  IncidenciaImportacionId,
  MedicoReferencia,
  NumeroEmpleado,
  PosicionRegistroOrigen,
  RegistroImportadoAgendaId,
  ServicioEspecialidad,
} from './value-objects/index.js';
import * as domainExports from './index.js';

const FECHA = AgendaFecha.parse('2026-08-21');

function citaSnapshot(index: number, overrides: Partial<CitaSnapshot> = {}): CitaSnapshot {
  const suffix = String(index).padStart(3, '0');
  return {
    folio: FolioCita.parse(`SYN-${suffix}`),
    agendaFecha: FECHA,
    hora: HoraCita.parse(`${String(index % 24).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`),
    expedienteReference: ExpedienteReferencia.parse(`REF-${suffix}`),
    nombrePaciente: `Persona sintética ${suffix}`,
    tipoDerechohabiente: index % 2 === 0 ? 'TRABAJADOR' : 'PENSIONADO',
    tipoConsulta: index % 2 === 0 ? 'FIRST_TIME' : 'SUBSEQUENT',
    medico: MedicoReferencia.create({
      numeroEmpleado: NumeroEmpleado.parse(`EMP-${String(index % 5).padStart(2, '0')}`),
      nombre: `Médico sintético ${index % 5}`,
    }),
    servicioEspecialidad: ServicioEspecialidad.create({
      codigo: `SRV-${index % 3}`,
      nombre: `Servicio sintético ${index % 3}`,
    }),
    ...overrides,
  };
}

describe('Domain verification — Agenda properties', () => {
  it.each([0, 1, 2, 8, 25])(
    'preserves reconciliation identities and idempotence for %i synthetic appointments',
    size => {
      const incoming = Array.from({ length: size }, (_, index) => citaSnapshot(index + 1));
      const agenda = Agenda.create({ fecha: FECHA });

      expect(agenda.reconcile({ incoming }).added).toHaveLength(size);
      const identities = [...agenda.citas];
      expect(agenda.reconcile({ incoming }).unchanged).toHaveLength(size);
      expect(agenda.citas).toEqual(identities);

      expect(agenda.reconcile({ incoming: [] }).withdrawn).toHaveLength(size);
      expect(agenda.reconcile({ incoming: [] }).withdrawn).toHaveLength(0);
      expect(agenda.reconcile({ incoming }).restored).toHaveLength(size);
      expect(agenda.citas).toEqual(identities);
      expect(agenda.citas.every(cita => cita.lifecycle === 'ACTIVA')).toBe(true);
    },
  );

  it('treats FOLIO as exact identity rather than patient, physician or expediente data', () => {
    const shared = {
      nombrePaciente: 'Misma persona sintética',
      expedienteReference: ExpedienteReferencia.parse('MISMA-REF'),
      medico: MedicoReferencia.create({
        numeroEmpleado: NumeroEmpleado.parse('EMP-01'),
        nombre: 'Mismo médico sintético',
      }),
    };
    const agenda = Agenda.create({ fecha: FECHA });
    const result = agenda.reconcile({ incoming: [
      citaSnapshot(1, { ...shared, folio: FolioCita.parse('folio-a') }),
      citaSnapshot(2, { ...shared, folio: FolioCita.parse('FOLIO-A') }),
    ] });

    expect(result.added.map(folio => folio.value)).toEqual(['folio-a', 'FOLIO-A']);
    expect(agenda.citas).toHaveLength(2);
  });

  it('keeps every pre-existing Cita unchanged when a later snapshot entry is invalid', () => {
    const initial = Array.from({ length: 10 }, (_, index) => Cita.create(citaSnapshot(index + 1)));
    const agenda = Agenda.create({ fecha: FECHA, citasIniciales: initial });
    const before = initial.map(cita => ({
      identity: cita,
      hora: cita.hora.value,
      lifecycle: cita.lifecycle,
    }));

    expect(() => agenda.reconcile({ incoming: [
      ...initial.map((_, index) => citaSnapshot(index + 1, { hora: HoraCita.parse('23:59') })),
      citaSnapshot(99, { agendaFecha: AgendaFecha.parse('2026-08-22') }),
    ] })).toThrowError(expect.objectContaining({ code: 'AGENDA_FECHA_INCOMPATIBLE' }));

    expect(agenda.citas.map((cita, index) => ({
      identity: cita,
      hora: cita.hora.value,
      lifecycle: cita.lifecycle,
    }))).toEqual(before);
  });
});

describe('Domain verification — import metrics properties', () => {
  const scenarios: readonly (readonly RecordProcessingResult[])[] = [
    [],
    ['ADDED'],
    ['UPDATED', 'UNCHANGED', 'RESTORED'],
    ['PENDING_REVIEW', 'REJECTED', 'DUPLICATE_FOLIO'],
    [...RECORD_PROCESSING_RESULTS, ...RECORD_PROCESSING_RESULTS],
  ];

  it.each(scenarios.map((results, index) => ({ index, results })))(
    'derives the canonical equations for synthetic distribution $index',
    ({ index, results }) => {
      const aggregate = ImportacionAgenda.create({
        id: ImportacionAgendaId.parse(`verification-${index}`),
        agendaFecha: FECHA,
        importedAt: new Date('2026-08-21T12:00:00.000Z'),
      });

      results.forEach((result, resultIndex) => {
        const position = resultIndex + 1;
        const recordId = RegistroImportadoAgendaId.parse(`record-${position}`);
        aggregate.addRegistro(createRecord(recordId, position));
        const incident = incidentFor(result);
        if (incident !== null) {
          aggregate.addIncidencia(IncidenciaImportacion.create({
            id: IncidenciaImportacionId.parse(`incident-${position}`),
            registroId: recordId,
            sourcePosition: PosicionRegistroOrigen.create(position),
            type: incident,
          }));
        }
        aggregate.finalizeRegistro(recordId, result);
      });

      aggregate.recordWithdrawnFromAgenda(index);
      aggregate.finalize(index === 0 ? 'ALREADY_IMPORTED' : 'RECONCILED');
      const metrics = aggregate.metrics;
      expect(metrics).not.toBeNull();
      expect(metrics?.processed).toBe(
        (metrics?.added ?? 0) + (metrics?.updated ?? 0) +
        (metrics?.unchanged ?? 0) + (metrics?.restored ?? 0),
      );
      expect(metrics?.receivedRecords).toBe(
        (metrics?.processed ?? 0) + (metrics?.pendingReview ?? 0) +
        (metrics?.rejected ?? 0) + (metrics?.duplicateFolio ?? 0),
      );
      expect(metrics?.errors).toBe((metrics?.rejected ?? 0) + (metrics?.duplicateFolio ?? 0));
      expect(metrics?.withdrawnFromAgenda).toBe(index);
    },
  );
});

describe('Domain verification — closed scope', () => {
  it('keeps taxonomies closed and does not expose deferred events or excluded concepts', () => {
    expect(IMPORT_OUTCOMES).toEqual(['IMPORTED', 'ALREADY_IMPORTED', 'RECONCILED']);
    expect(RECORD_PROCESSING_RESULTS).toEqual([
      'ADDED', 'UPDATED', 'UNCHANGED', 'RESTORED',
      'PENDING_REVIEW', 'REJECTED', 'DUPLICATE_FOLIO',
    ]);
    expect(IMPORT_INCIDENTS).toEqual([
      'PHYSICIAN_NOT_RESOLVED', 'PHYSICIAN_AMBIGUOUS', 'SERVICE_NOT_RESOLVED',
      'EXPEDIENT_NOT_RESOLVED', 'REQUIRED_DATA_MISSING', 'ROW_INCONSISTENT',
      'DUPLICATE_FOLIO_IN_SNAPSHOT',
    ]);
    expect(Object.keys(domainExports)).not.toEqual(expect.arrayContaining([
      'AgendaReconciled', 'CitaWithdrawnFromAgenda', 'CitaRestored',
      'Turno', 'Consultorio', 'Destino', 'Capability',
    ]));
  });
});

function createRecord(
  id: RegistroImportadoAgendaId,
  position: number,
): RegistroImportadoAgenda {
  return RegistroImportadoAgenda.create({
    id,
    sourcePosition: PosicionRegistroOrigen.create(position),
    originalValues: {
      folio: `SYN-${position}`,
      patientName: 'Persona sintética',
      expedienteReference: 'REF-SINTETICA',
      beneficiaryType: 'TRABAJADOR',
      firstTimeMarker: 'X',
      subsequentMarker: null,
      agendaDate: '21/08/2026',
      appointmentTime: '08:00',
      physicianEmployeeNumber: 'EMP-01',
      physicianName: 'Médico sintético',
      serviceCode: 'SRV-01',
      serviceName: 'Servicio sintético',
    },
    interpretedValues: {
      folio: FolioCita.parse(`SYN-${position}`),
      agendaFecha: FECHA,
      beneficiaryType: 'TRABAJADOR',
      appointmentKind: 'FIRST_TIME',
      appointmentTime: '08:00',
      numeroEmpleado: NumeroEmpleado.parse('EMP-01'),
      servicioEspecialidad: ServicioEspecialidad.create({ codigo: 'SRV-01', nombre: 'Servicio sintético' }),
    },
    resolvedReferences: {
      expedienteId: 'REF-SINTETICA',
      physicianReference: 'MEDICO-SINTETICO',
    },
  });
}

function incidentFor(result: RecordProcessingResult): ImportIncident | null {
  switch (result) {
    case 'PENDING_REVIEW': return 'PHYSICIAN_NOT_RESOLVED';
    case 'REJECTED': return 'ROW_INCONSISTENT';
    case 'DUPLICATE_FOLIO': return 'DUPLICATE_FOLIO_IN_SNAPSHOT';
    default: return null;
  }
}
