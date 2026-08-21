import { DomainError } from '@sigac/domain-kernel';

export class ExpedienteReferencia {
  private constructor(readonly value: string) {}

  static parse(value: string): ExpedienteReferencia {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new DomainError(
        'EXPEDIENTE_REFERENCIA_INVALID',
        'La referencia de Expediente debe ser un string no vacío.',
      );
    }
    return new ExpedienteReferencia(value.trim());
  }

  equals(other: ExpedienteReferencia): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
}
