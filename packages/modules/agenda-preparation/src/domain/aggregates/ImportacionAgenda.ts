import { DomainError } from '@sigac/domain-kernel';
import { IncidenciaImportacion, RegistroImportadoAgenda } from '../entities/index.js';
import {
  IMPORT_OUTCOMES,
  type ImportIncident,
  type ImportOutcome,
  type RecordProcessingResult,
} from '../types/index.js';
import {
  AgendaFecha,
  ImportacionAgendaId,
  RegistroImportadoAgendaId,
} from '../value-objects/index.js';

export interface ImportacionAgendaMetrics {
  readonly receivedRecords: number;
  readonly processed: number;
  readonly added: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly restored: number;
  readonly pendingReview: number;
  readonly rejected: number;
  readonly duplicateFolio: number;
  readonly withdrawnFromAgenda: number;
  readonly incidents: number;
  readonly errors: number;
}

export interface CreateImportacionAgendaInput {
  readonly id: ImportacionAgendaId;
  readonly agendaFecha: AgendaFecha;
  readonly importedAt: Date;
}

const RESOLUTION_INCIDENTS: readonly ImportIncident[] = [
  'PHYSICIAN_NOT_RESOLVED', 'PHYSICIAN_AMBIGUOUS', 'SERVICE_NOT_RESOLVED', 'EXPEDIENT_NOT_RESOLVED',
];
const REJECTION_INCIDENTS: readonly ImportIncident[] = ['REQUIRED_DATA_MISSING', 'ROW_INCONSISTENT'];

export class ImportacionAgenda {
  readonly id: ImportacionAgendaId;
  readonly agendaFecha: AgendaFecha;
  private readonly importedAtValue: Date;
  private readonly records: RegistroImportadoAgenda[] = [];
  private readonly incidents: IncidenciaImportacion[] = [];
  private _outcome: ImportOutcome | null = null;
  private _metrics: ImportacionAgendaMetrics | null = null;
  private withdrawnFromAgenda = 0;
  private withdrawalsRecorded = false;

  private constructor(input: CreateImportacionAgendaInput) {
    this.id = input.id;
    this.agendaFecha = input.agendaFecha;
    this.importedAtValue = new Date(input.importedAt.getTime());
  }

  static create(input: CreateImportacionAgendaInput): ImportacionAgenda {
    if (
      !(input?.id instanceof ImportacionAgendaId) ||
      !(input.agendaFecha instanceof AgendaFecha) ||
      !(input.importedAt instanceof Date) ||
      Number.isNaN(input.importedAt.getTime())
    ) {
      throw invalidImportacion('La importación requiere identidad, fecha de Agenda e instante válidos.');
    }
    return new ImportacionAgenda(input);
  }

  get importedAt(): Date { return new Date(this.importedAtValue.getTime()); }
  get outcome(): ImportOutcome | null { return this._outcome; }
  get registros(): readonly RegistroImportadoAgenda[] { return [...this.records]; }
  get incidencias(): readonly IncidenciaImportacion[] { return [...this.incidents]; }
  get metrics(): ImportacionAgendaMetrics | null { return this._metrics === null ? null : { ...this._metrics }; }

  addRegistro(registro: RegistroImportadoAgenda): void {
    this.ensureBuilding();
    if (!(registro instanceof RegistroImportadoAgenda)) {
      throw invalidImportacion('El registro importado es inválido.');
    }
    if (this.records.some(existing => existing.id.equals(registro.id))) {
      throw new DomainError('REGISTRO_IMPORTADO_DUPLICADO', 'El registro importado ya fue agregado.');
    }
    this.records.push(registro);
  }

  addIncidencia(incidencia: IncidenciaImportacion): void {
    this.ensureBuilding();
    if (!(incidencia instanceof IncidenciaImportacion)) {
      throw invalidImportacion('La incidencia de importación es inválida.');
    }
    if (this.incidents.some(existing => existing.id.equals(incidencia.id))) {
      throw new DomainError('INCIDENCIA_IMPORTACION_DUPLICADA', 'La incidencia de importación ya fue agregada.');
    }
    const registro = this.findRegistro(incidencia.registroId);
    if (!registro || !registro.sourcePosition.equals(incidencia.sourcePosition)) {
      throw invalidImportacion('La incidencia no corresponde a un registro y posición existentes.');
    }
    registro.attachIncident(incidencia.id);
    this.incidents.push(incidencia);
  }

  finalizeRegistro(registroId: RegistroImportadoAgendaId, result: RecordProcessingResult): void {
    this.ensureBuilding();
    const registro = this.findRegistro(registroId);
    if (!registro) {
      throw invalidImportacion('No existe el registro que se intenta finalizar.');
    }
    if (registro.processingResult !== null) {
      registro.finalize(result);
    }
    const incidentTypes = this.incidents
      .filter(incident => incident.registroId.equals(registroId))
      .map(incident => incident.type);
    if (!areCompatible(result, incidentTypes)) {
      throw invalidImportacion('El resultado no es compatible con las incidencias del registro.');
    }
    registro.finalize(result);
  }

  recordWithdrawnFromAgenda(count: number): void {
    this.ensureBuilding();
    if (this.withdrawalsRecorded || !Number.isInteger(count) || count < 0) {
      throw invalidImportacion('El conteo de retiros sólo puede registrarse una vez como entero no negativo.');
    }
    this.withdrawnFromAgenda = count;
    this.withdrawalsRecorded = true;
  }

  finalize(outcome: ImportOutcome): void {
    this.ensureBuilding();
    if (!IMPORT_OUTCOMES.includes(outcome) || this.records.some(record => record.processingResult === null)) {
      throw invalidImportacion('La importación requiere un outcome válido y todos sus registros finalizados.');
    }
    const metrics = deriveMetrics(this.records, this.incidents.length, this.withdrawnFromAgenda);
    validateMetrics(metrics);
    this._metrics = Object.freeze(metrics);
    this._outcome = outcome;
  }

  private ensureBuilding(): void {
    if (this._outcome !== null) {
      throw new DomainError('IMPORTACION_AGENDA_YA_FINALIZADA', 'La importación ya fue finalizada.');
    }
  }

  private findRegistro(id: RegistroImportadoAgendaId): RegistroImportadoAgenda | undefined {
    return this.records.find(record => record.id.equals(id));
  }
}

function areCompatible(result: RecordProcessingResult, incidents: readonly ImportIncident[]): boolean {
  switch (result) {
    case 'ADDED':
    case 'UPDATED':
    case 'UNCHANGED':
    case 'RESTORED':
      return incidents.length === 0;
    case 'PENDING_REVIEW':
      return incidents.length > 0 && incidents.every(value => RESOLUTION_INCIDENTS.includes(value));
    case 'REJECTED':
      return incidents.length > 0 && incidents.every(value => REJECTION_INCIDENTS.includes(value));
    case 'DUPLICATE_FOLIO':
      return incidents.length > 0 && incidents.every(value => value === 'DUPLICATE_FOLIO_IN_SNAPSHOT');
  }
}

function deriveMetrics(
  records: readonly RegistroImportadoAgenda[],
  incidents: number,
  withdrawnFromAgenda: number,
): ImportacionAgendaMetrics {
  const count = (result: RecordProcessingResult): number => records.filter(record => record.processingResult === result).length;
  const added = count('ADDED');
  const updated = count('UPDATED');
  const unchanged = count('UNCHANGED');
  const restored = count('RESTORED');
  const pendingReview = count('PENDING_REVIEW');
  const rejected = count('REJECTED');
  const duplicateFolio = count('DUPLICATE_FOLIO');
  return {
    receivedRecords: records.length,
    processed: added + updated + unchanged + restored,
    added,
    updated,
    unchanged,
    restored,
    pendingReview,
    rejected,
    duplicateFolio,
    withdrawnFromAgenda,
    incidents,
    errors: rejected + duplicateFolio,
  };
}

function validateMetrics(metrics: ImportacionAgendaMetrics): void {
  const valid = Object.values(metrics).every(value => Number.isInteger(value) && value >= 0) &&
    metrics.processed === metrics.added + metrics.updated + metrics.unchanged + metrics.restored &&
    metrics.receivedRecords === metrics.processed + metrics.pendingReview + metrics.rejected + metrics.duplicateFolio &&
    metrics.errors === metrics.rejected + metrics.duplicateFolio;
  if (!valid) {
    throw new DomainError('IMPORTACION_AGENDA_METRICAS_INCONSISTENTES', 'Las métricas derivadas de la importación son inconsistentes.');
  }
}

function invalidImportacion(message: string): DomainError {
  return new DomainError('IMPORTACION_AGENDA_INVALID', message);
}
