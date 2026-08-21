import { DomainError } from '@sigac/domain-kernel';

export class NumeroEmpleado {
  private constructor(readonly value: string) {}

  static parse(value: string): NumeroEmpleado {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new DomainError('NUMERO_EMPLEADO_INVALID', 'El número de empleado es obligatorio.');
    }
    return new NumeroEmpleado(value.trim());
  }

  equals(other: NumeroEmpleado): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
}
