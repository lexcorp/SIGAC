import { DomainError } from '@sigac/domain-kernel';

/**
 * NumeroVale — Value Object (branded class)
 *
 * Identificador textual asignado institucionalmente al formato SM 1-14
 * (p. ej. VA-2026-00142). Texto libre, único por tenant.
 *
 * Fuente: REQ-VA-001.1, design.md §10.1
 */
export class NumeroVale {
  private constructor(readonly value: string) {}

  /** Construye el VO desde un string no vacío. Aplica trim. */
  static parse(value: string): NumeroVale {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new DomainError(
        'NUMERO_VALE_INVALIDO',
        'El número de vale no puede estar vacío.',
      );
    }
    return new NumeroVale(trimmed);
  }

  equals(other: NumeroVale): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
