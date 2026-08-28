import { DomainError } from '@sigac/domain-kernel';

/**
 * SolicitanteReferencia — Value Object
 *
 * Registro nominal del solicitante o autorizador (nombre + cargo).
 * No es un ActorContext de SIGAC; representa la autoridad institucional que firma el SM 1-14.
 *
 * Fuente: REQ-VA-001.2, INV-VA-002, design.md §10.1
 */
export interface SolicitanteReferencia {
  readonly nombre: string;
  readonly cargo: string;
}

/**
 * Valida y construye una SolicitanteReferencia.
 * Lanza DomainError si nombre o cargo son vacíos o solo espacios.
 */
export function parseSolicitanteReferencia(nombre: string, cargo: string): SolicitanteReferencia {
  const nombreTrimmed = nombre.trim();
  const cargoTrimmed = cargo.trim();

  if (nombreTrimmed.length === 0) {
    throw new DomainError(
      'SOLICITANTE_REFERENCIA_INVALIDA',
      'El nombre del solicitante/autorizador no puede estar vacío.',
    );
  }

  if (cargoTrimmed.length === 0) {
    throw new DomainError(
      'SOLICITANTE_REFERENCIA_INVALIDA',
      'El cargo del solicitante/autorizador no puede estar vacío.',
    );
  }

  return Object.freeze({ nombre: nombreTrimmed, cargo: cargoTrimmed });
}
