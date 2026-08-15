/**
 * EstadoOperativo — Value Object
 *
 * Catálogo de estados operativos válidos para el aggregate Expediente.
 *
 * Fuente: DEC-EW-STATE-001, DDD-012 v0.2.0, INV-EXP-004
 *
 * IMPORTANTE:
 * - EN_BUSQUEDA NO es un EstadoOperativo del Expediente; pertenece al aggregate Solicitud.
 * - PRESTADO NO es un EstadoOperativo del Expediente; pertenece al aggregate Préstamo.
 */

import { DomainError } from '@sigac/domain-kernel';

/** Valores aceptados de EstadoOperativo (DEC-EW-STATE-001). */
export const ESTADOS_OPERATIVOS_VALIDOS = [
  'DISPONIBLE',
  'APARTADO',
  'EN_TRASLADO',
  'EN_CONSULTA',
  'NO_LOCALIZADO',
  'EXTRAVIADO',
] as const;

export type EstadoOperativo = (typeof ESTADOS_OPERATIVOS_VALIDOS)[number];

/**
 * Valida que un valor sea un EstadoOperativo aceptado.
 * Lanza DomainError si el valor no está en el catálogo,
 * incluyendo EN_BUSQUEDA y PRESTADO que pertenecen a otros aggregates.
 */
export function parseEstadoOperativo(value: string): EstadoOperativo {
  // Rechazo explícito de valores que pertenecen a otros aggregates
  if (value === 'EN_BUSQUEDA') {
    throw new DomainError(
      'ESTADO_OPERATIVO_INVALIDO',
      "EN_BUSQUEDA no es un EstadoOperativo del Expediente. Pertenece al aggregate Solicitud.",
    );
  }
  if (value === 'PRESTADO') {
    throw new DomainError(
      'ESTADO_OPERATIVO_INVALIDO',
      "PRESTADO no es un EstadoOperativo del Expediente. Pertenece al aggregate Préstamo.",
    );
  }

  if (!ESTADOS_OPERATIVOS_VALIDOS.includes(value as EstadoOperativo)) {
    throw new DomainError(
      'ESTADO_OPERATIVO_INVALIDO',
      `"${value}" no es un EstadoOperativo válido. Valores aceptados: ${ESTADOS_OPERATIVOS_VALIDOS.join(', ')}.`,
    );
  }

  return value as EstadoOperativo;
}

/** Type guard para EstadoOperativo. */
export function isEstadoOperativo(value: string): value is EstadoOperativo {
  return ESTADOS_OPERATIVOS_VALIDOS.includes(value as EstadoOperativo);
}
