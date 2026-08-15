export const APPLICATION_ERROR_CODES = [
  'PERMISSION_DENIED',
  'INSUFFICIENT_ENABLING_SOURCE',
  'EXPEDIENTE_NOT_FOUND',
  'OPTIMISTIC_LOCK_CONFLICT',
  'REQUEST_INVALID_TRANSITION',
] as const;

export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];

export class ApplicationError extends Error {
  readonly name = 'ApplicationError';

  constructor(readonly code: ApplicationErrorCode, message: string) {
    super(message);
  }
}
