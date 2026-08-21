import { DomainError } from '@sigac/domain-kernel';

export class ImportacionAgendaId {
  private constructor(readonly value: string) {}

  static parse(value: string): ImportacionAgendaId {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new DomainError('IMPORTACION_AGENDA_ID_INVALID', 'El identificador de importación es obligatorio.');
    }
    return new ImportacionAgendaId(value.trim());
  }

  equals(other: ImportacionAgendaId): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
}
