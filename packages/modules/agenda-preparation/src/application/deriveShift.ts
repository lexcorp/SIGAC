/**
 * deriveShift — ADR-0031 v1.1
 *
 * Pure function that derives the operational shift (turno) from an appointment
 * time in HH:mm format.
 *
 * Rule (approved):
 *   hour < 14  → MATUTINO   (~07:00–13:59)
 *   hour >= 14 → VESPERTINO (~14:00–20:00+)
 *
 * Design constraints:
 * - NO persistence — the shift is never stored in any table.
 * - NOT read from SIMEF — SIMEF has no "Turno" column.
 * - NOT added to PreparationItem in this iteration (deferred to T-28+, see ADR-0031).
 * - Used by PDFKitPreparationReportGenerator (imported, not reimplemented there).
 * - May be used by future consumers: web view, filters, dashboards, exports.
 *
 * Source: preparation-reports REQ-PR-009, design.md §2b.
 */

/** Operational shift (turno) as used by Archivo Clínico. */
export type AgendaShift = 'MATUTINO' | 'VESPERTINO';

/**
 * Derives the shift from an appointment time string in HH:mm canonical format.
 *
 * @param appointmentTime - HH:mm string as stored in PreparationItem.appointmentTime
 *   (always normalized by the SIMEF ACL — never raw SIMEF interval).
 * @returns 'MATUTINO' if hour < 14, 'VESPERTINO' if hour >= 14.
 *
 * @example
 *   deriveShift('07:00') // → 'MATUTINO'
 *   deriveShift('13:59') // → 'MATUTINO'
 *   deriveShift('14:00') // → 'VESPERTINO'
 *   deriveShift('23:59') // → 'VESPERTINO'
 */
export function deriveShift(appointmentTime: string): AgendaShift {
  const [hoursStr] = appointmentTime.split(':');
  const hours = parseInt(hoursStr ?? '0', 10);
  return hours < 14 ? 'MATUTINO' : 'VESPERTINO';
}
