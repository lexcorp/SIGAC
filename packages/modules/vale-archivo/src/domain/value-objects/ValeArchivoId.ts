import { randomUUID } from 'node:crypto';
import { DomainError } from '@sigac/domain-kernel';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ValeArchivoId — Value Object (branded class)
 *
 * Identidad técnica del Aggregate ValeArchivo.
 * Fuente: design.md §10.1
 */
export class ValeArchivoId {
  private constructor(readonly value: string) {}

  /** Construye el VO desde un UUID existente (persistencia / hydration). */
  static parse(value: string): ValeArchivoId {
    if (!UUID_PATTERN.test(value)) {
      throw new DomainError(
        'VALE_ARCHIVO_ID_INVALIDO',
        'ValeArchivoId debe ser un UUID válido.',
      );
    }
    return new ValeArchivoId(value.toLowerCase());
  }

  /** Genera una nueva identidad aleatoria (creación). */
  static generate(): ValeArchivoId {
    return new ValeArchivoId(randomUUID());
  }

  equals(other: ValeArchivoId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
