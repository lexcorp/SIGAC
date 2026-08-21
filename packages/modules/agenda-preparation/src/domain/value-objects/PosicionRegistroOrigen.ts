import { DomainError } from '@sigac/domain-kernel';

export class PosicionRegistroOrigen {
  private constructor(readonly value: number) {}
  static create(value: number): PosicionRegistroOrigen {
    if (!Number.isInteger(value) || value < 1) {
      throw new DomainError('POSICION_REGISTRO_ORIGEN_INVALID', 'La posición de origen debe ser un entero positivo base 1.');
    }
    return new PosicionRegistroOrigen(value);
  }
  equals(other: PosicionRegistroOrigen): boolean { return this.value === other.value; }
  toString(): string { return String(this.value); }
}
