export const APPLICATION_ERROR_CODES = [
  'PERMISSION_DENIED',
  'AGENDA_IMPORT_NOT_FOUND',
  'AGENDA_NOT_FOUND',
  'IDEMPOTENCY_KEY_REUSED',
  // T-21 preparation-reports REQ-PR-002 §6
  'NO_ACTIVE_APPOINTMENTS',
] as const;

export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];

export class ApplicationError extends Error {
  readonly name = 'ApplicationError';

  constructor(readonly code: ApplicationErrorCode, message: string) {
    super(message);
  }
}
