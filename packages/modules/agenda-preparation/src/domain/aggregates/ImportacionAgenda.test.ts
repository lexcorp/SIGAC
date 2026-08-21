import { DomainError } from '@sigac/domain-kernel';
import { describe, expect, it } from 'vitest';
import { ImportacionAgenda } from './ImportacionAgenda.js';
import { IncidenciaImportacion } from '../entities/IncidenciaImportacion.js';
import { RegistroImportadoAgenda } from '../entities/RegistroImportadoAgenda.js';
import {
  ImportacionAgendaId,
  IncidenciaImportacionId,
  RegistroImportadoAgendaId,
} from '../value-objects/index.js';
import { AgendaFecha, FolioCita, NumeroEmpleado, PosicionRegistroOrigen, ServicioEspecialidad } from '../value-objects/index.js';
import type { ImportIncident, RecordProcessingResult } from '../types/index.js';

const importedAt = new Date('2026-08-21T15:00:00.000Z');

function expectDomainError(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`Expected DomainError ${code}`);
}

function createAggregate(): ImportacionAgenda {
  return ImportacionAgenda.create({
    id: ImportacionAgendaId.parse(' import-001 '),
    agendaFecha: AgendaFecha.parse('2026-08-21'),
    importedAt,
  });
}

function createRegistro(id: string, position: number): RegistroImportadoAgenda {
  return RegistroImportadoAgenda.create({
    id: RegistroImportadoAgendaId.parse(id),
    sourcePosition: PosicionRegistroOrigen.create(position),
    originalValues: {
      folio: `F-${position}`,
      patientName: 'Paciente sintético',
      expedienteReference: 'EXP-SINTETICO',
      beneficiaryType: 'TRABAJADOR',
      firstTimeMarker: 'X',
      subsequentMarker: null,
      agendaDate: '21/08/2026',
      appointmentTime: '09:00',
      physicianEmployeeNumber: '00123',
      physicianName: 'Médico sintético',
      serviceCode: 'CAR',
      serviceName: 'Cardiología',
    },
    interpretedValues: {
      folio: FolioCita.parse(`F-${position}`),
      agendaFecha: AgendaFecha.parse('2026-08-21'),
      beneficiaryType: 'TRABAJADOR',
      appointmentKind: 'FIRST_TIME',
      appointmentTime: '09:00',
      numeroEmpleado: NumeroEmpleado.parse('00123'),
      servicioEspecialidad: ServicioEspecialidad.create({ codigo: 'CAR', nombre: 'Cardiología' }),
    },
    resolvedReferences: {
      expedienteId: 'expediente-ref-1',
      physicianReference: 'physician-ref-1',
    },
  });
}

function createIncident(id: string, registroId: string, position: number, type: ImportIncident): IncidenciaImportacion {
  return IncidenciaImportacion.create({
    id: IncidenciaImportacionId.parse(id),
    registroId: RegistroImportadoAgendaId.parse(registroId),
    sourcePosition: PosicionRegistroOrigen.create(position),
    type,
  });
}

describe('ImportacionAgenda IDs', () => {
  it.each([
    [() => ImportacionAgendaId.parse(' '), 'IMPORTACION_AGENDA_ID_INVALID'],
    [() => RegistroImportadoAgendaId.parse(''), 'REGISTRO_IMPORTADO_AGENDA_ID_INVALID'],
    [() => IncidenciaImportacionId.parse('\t'), 'INCIDENCIA_IMPORTACION_ID_INVALID'],
  ])('rejects invalid IDs with their approved code', (action, code) => expectDomainError(action, code));

  it('trims exterior whitespace and compares exact opaque values', () => {
    expect(ImportacionAgendaId.parse(' id-01 ').value).toBe('id-01');
    expect(RegistroImportadoAgendaId.parse('A').equals(RegistroImportadoAgendaId.parse('A'))).toBe(true);
    expect(IncidenciaImportacionId.parse('a').equals(IncidenciaImportacionId.parse('A'))).toBe(false);
  });
});

describe('ImportacionAgenda lifecycle', () => {
  it('creates in BUILDING without outcome or metrics and preserves externally supplied time', () => {
    const aggregate = createAggregate();
    expect(aggregate.id.value).toBe('import-001');
    expect(aggregate.agendaFecha.value).toBe('2026-08-21');
    expect(aggregate.importedAt.toISOString()).toBe(importedAt.toISOString());
    expect(aggregate.importedAt).not.toBe(importedAt);
    expect(aggregate.outcome).toBeNull();
    expect(aggregate.metrics).toBeNull();
  });

  it('finalizes every record exactly once and rejects a second assignment', () => {
    const aggregate = createAggregate();
    aggregate.addRegistro(createRegistro('record-1', 1));
    aggregate.finalizeRegistro(RegistroImportadoAgendaId.parse('record-1'), 'ADDED');
    expect(aggregate.registros[0]?.processingResult).toBe('ADDED');
    expectDomainError(
      () => aggregate.finalizeRegistro(RegistroImportadoAgendaId.parse('record-1'), 'ADDED'),
      'REGISTRO_IMPORTADO_RESULTADO_YA_ASIGNADO',
    );
  });

  it('allows 0..N compatible incidents and deduplicates by identity', () => {
    const aggregate = createAggregate();
    aggregate.addRegistro(createRegistro('record-1', 1));
    aggregate.addIncidencia(createIncident('incident-1', 'record-1', 1, 'PHYSICIAN_NOT_RESOLVED'));
    aggregate.addIncidencia(createIncident('incident-2', 'record-1', 1, 'SERVICE_NOT_RESOLVED'));
    expect(aggregate.incidencias).toHaveLength(2);
    expect(aggregate.registros[0]?.incidentIds).toHaveLength(2);
    expectDomainError(
      () => aggregate.addIncidencia(createIncident('incident-1', 'record-1', 1, 'PHYSICIAN_NOT_RESOLVED')),
      'INCIDENCIA_IMPORTACION_DUPLICADA',
    );
    aggregate.finalizeRegistro(RegistroImportadoAgendaId.parse('record-1'), 'PENDING_REVIEW');
  });

  it('rejects duplicate records and incompatible result/incident combinations', () => {
    const aggregate = createAggregate();
    aggregate.addRegistro(createRegistro('record-1', 1));
    expectDomainError(() => aggregate.addRegistro(createRegistro('record-1', 2)), 'REGISTRO_IMPORTADO_DUPLICADO');
    aggregate.addIncidencia(createIncident('incident-1', 'record-1', 1, 'ROW_INCONSISTENT'));
    expectDomainError(
      () => aggregate.finalizeRegistro(RegistroImportadoAgendaId.parse('record-1'), 'PENDING_REVIEW'),
      'IMPORTACION_AGENDA_INVALID',
    );
  });

  it('derives canonical metrics from multiple records, incidents and withdrawals', () => {
    const aggregate = createAggregate();
    const outcomes: readonly RecordProcessingResult[] = [
      'ADDED', 'UPDATED', 'UNCHANGED', 'RESTORED', 'PENDING_REVIEW', 'REJECTED', 'DUPLICATE_FOLIO',
    ];
    outcomes.forEach((_, index) => aggregate.addRegistro(createRegistro(`record-${index + 1}`, index + 1)));
    aggregate.addIncidencia(createIncident('incident-1', 'record-5', 5, 'PHYSICIAN_AMBIGUOUS'));
    aggregate.addIncidencia(createIncident('incident-2', 'record-6', 6, 'REQUIRED_DATA_MISSING'));
    aggregate.addIncidencia(createIncident('incident-3', 'record-7', 7, 'DUPLICATE_FOLIO_IN_SNAPSHOT'));
    outcomes.forEach((result, index) => aggregate.finalizeRegistro(RegistroImportadoAgendaId.parse(`record-${index + 1}`), result));
    aggregate.recordWithdrawnFromAgenda(2);
    aggregate.finalize('RECONCILED');

    expect(aggregate.metrics).toEqual({
      receivedRecords: 7,
      processed: 4,
      added: 1,
      updated: 1,
      unchanged: 1,
      restored: 1,
      pendingReview: 1,
      rejected: 1,
      duplicateFolio: 1,
      withdrawnFromAgenda: 2,
      incidents: 3,
      errors: 2,
    });
    expect(aggregate.metrics?.receivedRecords).toBe(
      (aggregate.metrics?.processed ?? 0) +
      (aggregate.metrics?.pendingReview ?? 0) +
      (aggregate.metrics?.rejected ?? 0) +
      (aggregate.metrics?.duplicateFolio ?? 0),
    );
  });

  it('requires all records finalized and allows only one final outcome', () => {
    const aggregate = createAggregate();
    aggregate.addRegistro(createRegistro('record-1', 1));
    expectDomainError(() => aggregate.finalize('IMPORTED'), 'IMPORTACION_AGENDA_INVALID');
    aggregate.finalizeRegistro(RegistroImportadoAgendaId.parse('record-1'), 'UNCHANGED');
    aggregate.finalize('ALREADY_IMPORTED');
    expect(aggregate.outcome).toBe('ALREADY_IMPORTED');
    expectDomainError(() => aggregate.finalize('ALREADY_IMPORTED'), 'IMPORTACION_AGENDA_YA_FINALIZADA');
    expectDomainError(() => aggregate.recordWithdrawnFromAgenda(0), 'IMPORTACION_AGENDA_YA_FINALIZADA');
    expectDomainError(() => aggregate.addRegistro(createRegistro('record-2', 2)), 'IMPORTACION_AGENDA_YA_FINALIZADA');
  });

  it('does not expose artifact metadata, raw or excluded fields', () => {
    const aggregate = createAggregate();
    aggregate.addRegistro(createRegistro('record-1', 1));
    expect(Object.keys(aggregate)).not.toEqual(expect.arrayContaining([
      'fingerprint', 'filename', 'mime', 'stagingPath', 'rawArtifact', 'encoding', 'raw',
      'contact', 'curp', 'sex', 'age', 'turno', 'consultorio', 'destino',
    ]));
    expect(Object.keys(aggregate.registros[0]?.originalValues ?? {})).toEqual([
      'folio', 'patientName', 'expedienteReference', 'beneficiaryType', 'firstTimeMarker',
      'subsequentMarker', 'agendaDate', 'appointmentTime', 'physicianEmployeeNumber',
      'physicianName', 'serviceCode', 'serviceName',
    ]);
  });
});
