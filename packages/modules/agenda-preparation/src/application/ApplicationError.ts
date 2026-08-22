export const APPLICATION_ERROR_CODES = [
  'PERMISSION_DENIED',
  'AGENDA_IMPORT_NOT_FOUND',
  'AGENDA_NOT_FOUND',
  'IDEMPOTENCY_KEY_REUSED',
] as const;

export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];

export class ApplicationError extends Error {
  readonly name = 'ApplicationError';

  constructor(readonly code: ApplicationErrorCode, message: string) {
    super(message);
  }
}
