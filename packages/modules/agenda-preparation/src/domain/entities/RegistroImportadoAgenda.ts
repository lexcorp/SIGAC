import { DomainError } from '@sigac/domain-kernel';
import type { RecordProcessingResult } from '../types/index.js';
import {
  AgendaFecha,
  FolioCita,
  IncidenciaImportacionId,
  NumeroEmpleado,
  PosicionRegistroOrigen,
  RegistroImportadoAgendaId,
  ServicioEspecialidad,
} from '../value-objects/index.js';

export type AppointmentKind = 'FIRST_TIME' | 'SUBSEQUENT';

export interface RegistroImportadoAgendaOriginalValues {
  readonly folio: string | null;
  readonly patientName: string | null;
  readonly expedienteReference: string | null;
  readonly beneficiaryType: string | null;
  readonly firstTimeMarker: string | null;
  readonly subsequentMarker: string | null;
  readonly agendaDate: string | null;
  readonly appointmentTime: string | null;
  readonly physicianEmployeeNumber: string | null;
  readonly physicianName: string | null;
  readonly serviceCode: string | null;
  readonly serviceName: string | null;
}

export interface RegistroImportadoAgendaInterpretedValues {
  readonly folio: FolioCita | null;
  readonly agendaFecha: AgendaFecha | null;
  readonly beneficiaryType: string | null;
  readonly appointmentKind: AppointmentKind | null;
  readonly appointmentTime: string | null;
  readonly numeroEmpleado: NumeroEmpleado | null;
  readonly servicioEspecialidad: ServicioEspecialidad | null;
}

export interface RegistroImportadoAgendaResolvedReferences {
  readonly expedienteId: string | null;
  readonly physicianReference: string | null;
}

export interface CreateRegistroImportadoAgendaInput {
  readonly id: RegistroImportadoAgendaId;
  readonly sourcePosition: PosicionRegistroOrigen;
  readonly originalValues: RegistroImportadoAgendaOriginalValues;
  readonly interpretedValues: RegistroImportadoAgendaInterpretedValues;
  readonly resolvedReferences: RegistroImportadoAgendaResolvedReferences;
}

export class RegistroImportadoAgenda {
  readonly id: RegistroImportadoAgendaId;
  readonly sourcePosition: PosicionRegistroOrigen;
  readonly originalValues: Readonly<RegistroImportadoAgendaOriginalValues>;
  readonly interpretedValues: Readonly<RegistroImportadoAgendaInterpretedValues>;
  readonly resolvedReferences: Readonly<RegistroImportadoAgendaResolvedReferences>;
  private _processingResult: RecordProcessingResult | null = null;
  private readonly _incidentIds: IncidenciaImportacionId[] = [];

  private constructor(input: CreateRegistroImportadoAgendaInput) {
    this.id = input.id;
    this.sourcePosition = input.sourcePosition;
    this.originalValues = Object.freeze(copyOriginalValues(input.originalValues));
    this.interpretedValues = Object.freeze(copyInterpretedValues(input.interpretedValues));
    this.resolvedReferences = Object.freeze(copyResolvedReferences(input.resolvedReferences));
  }

  static create(input: CreateRegistroImportadoAgendaInput): RegistroImportadoAgenda {
    validateRegistro(input);
    return new RegistroImportadoAgenda(input);
  }

  get processingResult(): RecordProcessingResult | null { return this._processingResult; }
  get incidentIds(): readonly IncidenciaImportacionId[] { return [...this._incidentIds]; }

  finalize(result: RecordProcessingResult): void {
    if (this._processingResult !== null) {
      throw new DomainError('REGISTRO_IMPORTADO_RESULTADO_YA_ASIGNADO', 'El registro importado ya tiene un resultado final.');
    }
    this._processingResult = result;
  }

  attachIncident(id: IncidenciaImportacionId): void {
    if (this._processingResult !== null) {
      throw invalidImportacion('No se pueden agregar incidencias a un registro finalizado.');
    }
    if (this._incidentIds.some(existing => existing.equals(id))) {
      throw new DomainError('INCIDENCIA_IMPORTACION_DUPLICADA', 'La incidencia ya está asociada al registro.');
    }
    this._incidentIds.push(id);
  }
}

function copyOriginalValues(values: RegistroImportadoAgendaOriginalValues): RegistroImportadoAgendaOriginalValues {
  return {
    folio: values.folio,
    patientName: values.patientName,
    expedienteReference: values.expedienteReference,
    beneficiaryType: values.beneficiaryType,
    firstTimeMarker: values.firstTimeMarker,
    subsequentMarker: values.subsequentMarker,
    agendaDate: values.agendaDate,
    appointmentTime: values.appointmentTime,
    physicianEmployeeNumber: values.physicianEmployeeNumber,
    physicianName: values.physicianName,
    serviceCode: values.serviceCode,
    serviceName: values.serviceName,
  };
}

function copyInterpretedValues(values: RegistroImportadoAgendaInterpretedValues): RegistroImportadoAgendaInterpretedValues {
  return {
    folio: values.folio,
    agendaFecha: values.agendaFecha,
    beneficiaryType: values.beneficiaryType,
    appointmentKind: values.appointmentKind,
    appointmentTime: values.appointmentTime,
    numeroEmpleado: values.numeroEmpleado,
    servicioEspecialidad: values.servicioEspecialidad,
  };
}

function copyResolvedReferences(values: RegistroImportadoAgendaResolvedReferences): RegistroImportadoAgendaResolvedReferences {
  return { expedienteId: values.expedienteId, physicianReference: values.physicianReference };
}

function validateRegistro(input: CreateRegistroImportadoAgendaInput): void {
  if (!(input?.id instanceof RegistroImportadoAgendaId) || !(input.sourcePosition instanceof PosicionRegistroOrigen)) {
    throw invalidImportacion('El registro importado requiere identidad y posición válidas.');
  }
  const originals = input.originalValues;
  if (!originals || Object.values(copyOriginalValues(originals)).some(value => value !== null && typeof value !== 'string')) {
    throw invalidImportacion('Los valores originales no cumplen la allow-list aprobada.');
  }
  const interpreted = input.interpretedValues;
  if (!interpreted || !isNullableString(interpreted.beneficiaryType) || !isNullableString(interpreted.appointmentTime)) {
    throw invalidImportacion('Los valores interpretados son inválidos.');
  }
  if (interpreted.appointmentKind !== null && interpreted.appointmentKind !== 'FIRST_TIME' && interpreted.appointmentKind !== 'SUBSEQUENT') {
    throw invalidImportacion('El tipo de cita interpretado es inválido.');
  }
  const references = input.resolvedReferences;
  if (!references || !isNullableNonEmptyReference(references.expedienteId) || !isNullableNonEmptyReference(references.physicianReference)) {
    throw invalidImportacion('Las referencias resueltas son inválidas.');
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNonEmptyReference(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.trim() !== '');
}

function invalidImportacion(message: string): DomainError {
  return new DomainError('IMPORTACION_AGENDA_INVALID', message);
}
