/**
 * FuenteHabilitanteSalida — Value Object (enum)
 *
 * Valor semántico que determina la política de autorización para la salida
 * o préstamo de un expediente.
 *
 * Fuente: DDD-007 v0.2.0, DECISION-REGISTER OQ-EW-005, BIZ-010, BIZ-016.
 *
 * REGLAS:
 * - CONSULTA_PROGRAMADA: habilitada por agenda; sin autorización individual adicional.
 * - VALE_ARCHIVO_SM_1_14: solicitud extraordinaria (SM 1-14); actores facultados:
 *   Director, Subdirector, Coordinación Médica; plazo máximo 24 horas.
 * - ORDEN_SUPERIOR: fuente válida reconocida; detalles fuera de este slice.
 */

import { DomainError } from '@sigac/domain-kernel';

export const FUENTES_HABILITANTES_SALIDA = [
  'CONSULTA_PROGRAMADA',
  'VALE_ARCHIVO_SM_1_14',
  'ORDEN_SUPERIOR',
] as const;

export type FuenteHabilitanteSalida = (typeof FUENTES_HABILITANTES_SALIDA)[number];

/**
 * Valida que un valor sea una FuenteHabilitanteSalida reconocida.
 * @throws DomainError si el valor no está en el catálogo.
 */
export function parseFuenteHabilitanteSalida(value: string): FuenteHabilitanteSalida {
  if (!FUENTES_HABILITANTES_SALIDA.includes(value as FuenteHabilitanteSalida)) {
    throw new DomainError(
      'FUENTE_HABILITANTE_INVALIDA',
      `"${value}" no es una FuenteHabilitanteSalida válida. ` +
        `Valores aceptados: ${FUENTES_HABILITANTES_SALIDA.join(', ')}.`,
    );
  }
  return value as FuenteHabilitanteSalida;
}

/** Type guard para FuenteHabilitanteSalida. */
export function isFuenteHabilitanteSalida(value: string): value is FuenteHabilitanteSalida {
  return FUENTES_HABILITANTES_SALIDA.includes(value as FuenteHabilitanteSalida);
}
