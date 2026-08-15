/**
 * ExpedienteNumero — Value Object
 *
 * Representa el identificador institucional del expediente clínico.
 *
 * Formato operativo confirmado: <RFC_BASE_10><SEPARADOR><CODIGO_DERECHOHABIENTE_2>
 * Ejemplo anonimizado: PERR810604/10
 *
 * Fuente: DDD-007 v0.2.0, DECISION-REGISTER OQ-EW-001, INV-EXP-001, INV-EXP-003
 *
 * REGLAS:
 * - rfcBase: exactamente 10 caracteres (RFC sin homoclave).
 * - separador: '/' (preferente), '-', o ausente.
 * - codigoDerechohabiente: uno de los valores del catálogo operativo.
 * - La forma normalizada (para búsqueda) omite el separador.
 * - La forma de presentación preferente usa '/'.
 * - expedienteNumero NO es identidad técnica primaria; ExpedienteId (UUID) lo es.
 * - No asumir unicidad; pueden existir múltiples expedientes con el mismo número.
 */

import { DomainError } from '@sigac/domain-kernel';

/**
 * Catálogo operativo de códigos de derechohabiente.
 * Fuente: SRC-INT-002, DECISION-REGISTER OQ-EW-001.
 */
export const CODIGOS_DERECHOHABIENTE = [
  '10', // Trabajador
  '20', // Trabajadora
  '30', // Esposa
  '40', // Concubina
  '50', // Padre o Abuelo
  '60', // Madre o Abuela
  '70', // Hijo
  '80', // Hija
  '90', // Pensionado
] as const;

export type CodigoDerechohabiente = (typeof CODIGOS_DERECHOHABIENTE)[number];

/**
 * El SDB sólo define la longitud del RFC base. Deliberadamente no se restringe
 * aquí su juego de caracteres.
 */
const EXPEDIENTE_NUMERO_REGEX = /^(.{10})[\/-]?(\d{2})$/;

export class ExpedienteNumero {
  /** RFC base: exactamente 10 caracteres. */
  readonly rfcBase: string;

  /** Código de derechohabiente del catálogo operativo. */
  readonly codigoDerechohabiente: CodigoDerechohabiente;

  private constructor(rfcBase: string, codigoDerechohabiente: CodigoDerechohabiente) {
    this.rfcBase = rfcBase;
    this.codigoDerechohabiente = codigoDerechohabiente;
  }

  /**
   * Crea un ExpedienteNumero desde un string en cualquier variante de separador.
   * Acepta: 'PERR810604/10', 'PERR810604-10', 'PERR81060410'.
   *
   * @throws DomainError si el formato es inválido o el código no está en el catálogo.
   */
  static parse(raw: string): ExpedienteNumero {
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new DomainError(
        'EXPEDIENTE_NUMERO_INVALIDO',
        'El número de expediente no puede estar vacío.',
      );
    }

    const match = EXPEDIENTE_NUMERO_REGEX.exec(raw);
    if (!match) {
      throw new DomainError(
        'EXPEDIENTE_NUMERO_INVALIDO',
        `El número de expediente "${raw}" no coincide con el patrón RFC_BASE_10 + (separador opcional) + CODIGO_2. ` +
          `Ejemplo: PERR810604/10, PERR810604-10 o PERR81060410.`,
      );
    }

    const rfcBase = match[1] as string;
    const codigo = match[2] as string;

    if (!CODIGOS_DERECHOHABIENTE.includes(codigo as CodigoDerechohabiente)) {
      throw new DomainError(
        'CODIGO_DERECHOHABIENTE_INVALIDO',
        `El código de derechohabiente "${codigo}" no está en el catálogo operativo. ` +
          `Valores aceptados: ${CODIGOS_DERECHOHABIENTE.join(', ')}.`,
      );
    }

    return new ExpedienteNumero(rfcBase, codigo as CodigoDerechohabiente);
  }

  /**
   * Forma normalizada para búsqueda en base de datos: sin separador.
   * PERR810604/10 -> 'PERR81060410'
   */
  toNormalized(): string {
    return `${this.rfcBase}${this.codigoDerechohabiente}`;
  }

  /**
   * Forma de presentación preferente: con '/' como separador.
   * Independientemente de cómo fue construido el VO.
   */
  toDisplay(): string {
    return `${this.rfcBase}/${this.codigoDerechohabiente}`;
  }

  /**
   * Igualdad por valor: dos ExpedienteNumero son iguales si tienen el mismo
   * rfcBase y codigoDerechohabiente, independientemente del separador original.
   */
  equals(other: ExpedienteNumero): boolean {
    return (
      this.rfcBase === other.rfcBase &&
      this.codigoDerechohabiente === other.codigoDerechohabiente
    );
  }

  toString(): string {
    return this.toDisplay();
  }
}
