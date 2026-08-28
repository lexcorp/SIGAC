import { DomainError } from '@sigac/domain-kernel';

/**
 * EstadoVale — Value Object
 *
 * Ciclo de vida del ValeArchivo (SM 1-14).
 * Fuente: REQ-VA-001..REQ-VA-007, INV-VA-010
 */

export const ESTADOS_VALE_VALIDOS = [
  'RECIBIDA',
  'EN_BUSQUEDA',
  'COMPLETA',
  'PARCIAL',
  'NO_LOCALIZADA',
  'ENTREGADA',
  'CERRADA',
] as const;

export type EstadoVale = (typeof ESTADOS_VALE_VALIDOS)[number];

/** Type guard para EstadoVale. */
export function isEstadoVale(value: string): value is EstadoVale {
  return ESTADOS_VALE_VALIDOS.includes(value as EstadoVale);
}

/**
 * Valida y parsea un EstadoVale.
 * Lanza DomainError si el valor no está en el catálogo.
 */
export function parseEstadoVale(value: string): EstadoVale {
  if (!isEstadoVale(value)) {
    throw new DomainError(
      'ESTADO_VALE_INVALIDO',
      `"${value}" no es un EstadoVale válido. Valores aceptados: ${ESTADOS_VALE_VALIDOS.join(', ')}.`,
    );
  }
  return value;
}

/**
 * Orden del ciclo de vida para verificar no-retroceso (INV-VA-010).
 * El valor numérico indica la posición en la progresión; estados terminales comparten el nivel más alto.
 */
export const ESTADO_VALE_ORDEN: Record<EstadoVale, number> = {
  RECIBIDA: 0,
  EN_BUSQUEDA: 1,
  COMPLETA: 2,
  PARCIAL: 2,
  NO_LOCALIZADA: 2,
  ENTREGADA: 3,
  CERRADA: 4,
};
