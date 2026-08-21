import { DomainError } from '@sigac/domain-kernel';

export class IncidenciaImportacionId {
  private constructor(readonly value: string) {}

  static parse(value: string): IncidenciaImportacionId {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new DomainError('INCIDENCIA_IMPORTACION_ID_INVALID', 'El identificador de incidencia de importación es obligatorio.');
    }
    return new IncidenciaImportacionId(value.trim());
  }

  equals(other: IncidenciaImportacionId): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
}
