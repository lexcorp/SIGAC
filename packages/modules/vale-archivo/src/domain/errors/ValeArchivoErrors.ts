import { DomainError } from '@sigac/domain-kernel';

/**
 * ValeArchivoErrors — Errores de dominio del bounded context Vale Archivo
 *
 * Fuente: design.md §6.5, INV-VA-001, INV-VA-010
 */

/**
 * INV-VA-001: Un ValeArchivo tiene al menos un ValeArchivoItem.
 * Se lanza cuando se intenta crear un ValeArchivo sin ítems.
 */
export class ValeRequiereItemsError extends DomainError {
  constructor() {
    super(
      'VALE_REQUIERE_ITEMS',
      'Un ValeArchivo debe contener al menos un ValeArchivoItem.',
    );
    this.name = 'ValeRequiereItemsError';
  }
}

/**
 * INV-VA-010: Las transiciones de estado son unidireccionales.
 * Se lanza cuando se intenta una transición de estado inválida.
 */
export class InvalidStateTransitionError extends DomainError {
  constructor(estadoActual: string, estadoDestino: string) {
    super(
      'INVALID_STATE_TRANSITION',
      `No es posible transicionar de "${estadoActual}" a "${estadoDestino}".`,
    );
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Se lanza cuando no se encuentra el ValeArchivo solicitado para el tenant activo.
 */
export class ValeArchivoNotFoundError extends DomainError {
  constructor(id: string) {
    super(
      'VALE_ARCHIVO_NOT_FOUND',
      `ValeArchivo con id "${id}" no encontrado.`,
    );
    this.name = 'ValeArchivoNotFoundError';
  }
}

/**
 * Se lanza cuando no se encuentra el ValeArchivoItem solicitado dentro del vale.
 */
export class ValeArchivoItemNotFoundError extends DomainError {
  constructor(itemId: string) {
    super(
      'VALE_ARCHIVO_ITEM_NOT_FOUND',
      `ValeArchivoItem con id "${itemId}" no encontrado en el vale.`,
    );
    this.name = 'ValeArchivoItemNotFoundError';
  }
}
