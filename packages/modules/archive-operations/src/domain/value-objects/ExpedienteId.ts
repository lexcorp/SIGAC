import { DomainError } from '@sigac/domain-kernel';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identidad técnica interna del aggregate Expediente. */
export class ExpedienteId {
  private constructor(readonly value: string) {}

  /** Construye el VO desde un UUID existente; no genera identidades. */
  static parse(value: string): ExpedienteId {
    if (!UUID_PATTERN.test(value)) {
      throw new DomainError('EXPEDIENTE_ID_INVALIDO', 'ExpedienteId debe ser un UUID válido.');
    }

    return new ExpedienteId(value.toLowerCase());
  }

  equals(other: ExpedienteId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
