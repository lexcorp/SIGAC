/**
 * Catálogo cerrado de errores Application de integración.
 * Permite al composition root y los adapters manejar exactamente
 * los casos declarados sin depender de errores de dominio de
 * los bounded contexts.
 */

export type AgendaValeIntegrationErrorCode =
  | 'PERMISSION_DENIED'
  | 'AGENDA_NOT_FOUND'
  | 'SOURCE_VERSION_STALE';

export class AgendaValeIntegrationError extends Error {
  override readonly name = 'AgendaValeIntegrationError';
  constructor(readonly code: AgendaValeIntegrationErrorCode, message: string) {
    super(message);
  }
}
