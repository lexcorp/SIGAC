import { DomainError } from '@sigac/domain-kernel';

const CANONICAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class HoraCita {
  private constructor(readonly value: string) {}

  static parse(value: string): HoraCita {
    if (typeof value !== 'string' || !CANONICAL_TIME.test(value)) {
      throw new DomainError(
        'HORA_CITA_INVALID',
        'La hora de la Cita debe usar el formato canónico HH:mm de 24 horas.',
      );
    }
    return new HoraCita(value);
  }

  equals(other: HoraCita): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
}
