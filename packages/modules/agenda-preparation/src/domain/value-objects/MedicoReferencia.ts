import { DomainError } from '@sigac/domain-kernel';
import { NumeroEmpleado } from './NumeroEmpleado.js';

export interface CreateMedicoReferenciaInput {
  readonly numeroEmpleado: NumeroEmpleado;
  readonly nombre: string;
}

export class MedicoReferencia {
  readonly numeroEmpleado: NumeroEmpleado;
  readonly nombre: string;

  private constructor(input: CreateMedicoReferenciaInput) {
    this.numeroEmpleado = input.numeroEmpleado;
    this.nombre = input.nombre;
  }

  static create(input: CreateMedicoReferenciaInput): MedicoReferencia {
    if (
      !(input?.numeroEmpleado instanceof NumeroEmpleado) ||
      typeof input.nombre !== 'string' ||
      input.nombre.trim() === ''
    ) {
      throw new DomainError(
        'MEDICO_REFERENCIA_INVALID',
        'La referencia de médico requiere número de empleado y nombre válidos.',
      );
    }
    return new MedicoReferencia({
      numeroEmpleado: input.numeroEmpleado,
      nombre: input.nombre.trim(),
    });
  }

  equals(other: MedicoReferencia): boolean {
    return this.numeroEmpleado.equals(other.numeroEmpleado);
  }
}
