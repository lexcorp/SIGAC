import { HttpException, Injectable } from '@nestjs/common';
import { ApplicationError } from '@sigac/archive-operations';

export const HTTP_FIELD_ERROR_CODES = [
  'REQUIRED',
  'INVALID_FORMAT',
  'INVALID_TYPE',
  'OUT_OF_RANGE',
] as const;
export type HttpFieldErrorCode = (typeof HTTP_FIELD_ERROR_CODES)[number];

export interface HttpFieldError {
  readonly field: string;
  readonly code: HttpFieldErrorCode;
}

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly errors?: readonly HttpFieldError[];
}

export class AuthenticationRequiredError extends Error {
  readonly name = 'AuthenticationRequiredError';
}

export class HttpValidationError extends Error {
  readonly name = 'HttpValidationError';

  constructor(readonly errors: readonly HttpFieldError[]) {
    super('HTTP request validation failed.');
  }
}

const APPLICATION_PROBLEMS = {
  PERMISSION_DENIED: {
    status: 403,
    title: 'Forbidden',
    type: 'https://sigac/errors/permission-denied',
    detail: 'The authenticated actor is not allowed to perform this operation.',
  },
  INSUFFICIENT_ENABLING_SOURCE: {
    status: 403,
    title: 'Forbidden',
    type: 'https://sigac/errors/insufficient-enabling-source',
    detail: 'The operation does not have an accepted enabling source.',
  },
  EXPEDIENTE_NOT_FOUND: {
    status: 404,
    title: 'Not Found',
    type: 'https://sigac/errors/expediente-not-found',
    detail: 'The requested Expediente was not found.',
  },
  OPTIMISTIC_LOCK_CONFLICT: {
    status: 409,
    title: 'Conflict',
    type: 'https://sigac/errors/optimistic-lock-conflict',
    detail: 'The Expediente was modified by another operation.',
  },
  REQUEST_INVALID_TRANSITION: {
    status: 409,
    title: 'Conflict',
    type: 'https://sigac/errors/request-invalid-transition',
    detail: 'The requested operation is not valid for the current state.',
  },
} as const;

@Injectable()
export class ApiProblemMapper {
  toHttpException(error: unknown): HttpException | null {
    if (error instanceof HttpValidationError) {
      return new HttpException(
        {
          type: 'https://sigac/errors/http-validation',
          title: 'Invalid request',
          status: 400,
          code: 'HTTP_VALIDATION_ERROR',
          detail: 'The request contains invalid or malformed values.',
          ...(error.errors.length > 0 ? { errors: error.errors } : {}),
        } satisfies ProblemDetails,
        400,
      );
    }

    if (error instanceof AuthenticationRequiredError) {
      return new HttpException(
        {
          type: 'https://sigac/errors/authentication-required',
          title: 'Unauthorized',
          status: 401,
          code: 'AUTHENTICATION_REQUIRED',
        } satisfies ProblemDetails,
        401,
      );
    }

    if (error instanceof ApplicationError) {
      const problem = APPLICATION_PROBLEMS[error.code];
      return new HttpException(
        {
          type: problem.type,
          title: problem.title,
          status: problem.status,
          code: error.code,
          detail: problem.detail,
        } satisfies ProblemDetails,
        problem.status,
      );
    }

    return null;
  }
}
