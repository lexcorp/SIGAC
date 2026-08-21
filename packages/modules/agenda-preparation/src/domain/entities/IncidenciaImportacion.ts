import { DomainError } from '@sigac/domain-kernel';
import { IMPORT_INCIDENTS, type ImportIncident } from '../types/index.js';
import { IncidenciaImportacionId, PosicionRegistroOrigen, RegistroImportadoAgendaId } from '../value-objects/index.js';

export interface CreateIncidenciaImportacionInput {
  readonly id: IncidenciaImportacionId;
  readonly registroId: RegistroImportadoAgendaId;
  readonly sourcePosition: PosicionRegistroOrigen;
  readonly type: ImportIncident;
}

export class IncidenciaImportacion {
  readonly id: IncidenciaImportacionId;
  readonly registroId: RegistroImportadoAgendaId;
  readonly sourcePosition: PosicionRegistroOrigen;
  readonly type: ImportIncident;

  private constructor(input: CreateIncidenciaImportacionInput) {
    this.id = input.id;
    this.registroId = input.registroId;
    this.sourcePosition = input.sourcePosition;
    this.type = input.type;
  }

  static create(input: CreateIncidenciaImportacionInput): IncidenciaImportacion {
    if (
      !(input?.id instanceof IncidenciaImportacionId) ||
      !(input.registroId instanceof RegistroImportadoAgendaId) ||
      !(input.sourcePosition instanceof PosicionRegistroOrigen) ||
      !IMPORT_INCIDENTS.includes(input.type)
    ) {
      throw new DomainError('IMPORTACION_AGENDA_INVALID', 'La incidencia de importación es inválida.');
    }
    return new IncidenciaImportacion(input);
  }
}
