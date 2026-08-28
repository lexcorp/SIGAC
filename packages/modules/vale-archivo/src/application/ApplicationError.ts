/**
 * ApplicationError — errores de capa de Application para Vale Archivo.
 *
 * Fuente: design.md §9.2, REQ-VA-001..REQ-VA-007
 *
 * Separados de DomainError: representan condiciones de negocio a nivel de
 * orquestación (permiso denegado, recurso no encontrado, etc.) que el
 * controller mapea a respuestas HTTP RFC 7807.
 */

export const APPLICATION_ERROR_CODES = [
  // Authorization
  'PERMISSION_DENIED',
  // Vale Archivo
  'VALE_ARCHIVO_NOT_FOUND',
  'VALE_ARCHIVO_ITEM_NOT_FOUND',
  'VALE_REQUIERE_ITEMS',
  'INVALID_STATE_TRANSITION',
  // T-BUG-VA-001: numero_vale must be unique within the tenant
  'VALE_NUMERO_DUPLICADO',
] as const;

export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];

export class ApplicationError extends Error {
  readonly name = 'ApplicationError';

  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
  ) {
    super(message);
  }
}
