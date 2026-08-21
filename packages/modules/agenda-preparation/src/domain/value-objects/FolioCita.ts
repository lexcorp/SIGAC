import { DomainError } from '@sigac/domain-kernel';

export class FolioCita {
  private constructor(readonly value: string) {}

  static parse(value: string): FolioCita {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new DomainError('FOLIO_CITA_INVALID', 'El FOLIO de cita es obligatorio.');
    }
    return new FolioCita(value.trim());
  }

  equals(other: FolioCita): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
}
