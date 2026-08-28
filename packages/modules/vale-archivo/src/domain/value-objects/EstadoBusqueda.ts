import { DomainError } from '@sigac/domain-kernel';

/**
 * EstadoBusqueda — Value Object
 *
 * Estado de localización individual por cada ValeArchivoItem.
 * Fuente: REQ-VA-005, design.md §10.1
 */

export const ESTADOS_BUSQUEDA_VALIDOS = ['PENDIENTE', 'LOCALIZADO', 'NO_LOCALIZADO'] as const;

export type EstadoBusqueda = (typeof ESTADOS_BUSQUEDA_VALIDOS)[number];

/** Type guard para EstadoBusqueda. */
export function isEstadoBusqueda(value: string): value is EstadoBusqueda {
  return ESTADOS_BUSQUEDA_VALIDOS.includes(value as EstadoBusqueda);
}

/**
 * Valida y parsea un EstadoBusqueda.
 * Lanza DomainError si el valor no está en el catálogo.
 */
export function parseEstadoBusqueda(value: string): EstadoBusqueda {
  if (!isEstadoBusqueda(value)) {
    throw new DomainError(
      'ESTADO_BUSQUEDA_INVALIDO',
      `"${value}" no es un EstadoBusqueda válido. Valores aceptados: ${ESTADOS_BUSQUEDA_VALIDOS.join(', ')}.`,
    );
  }
  return value;
}
