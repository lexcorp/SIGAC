import { HttpException, Injectable } from '@nestjs/common';
import { ApplicationError, LayoutRejectedError } from '@sigac/agenda-preparation';

// ---------------------------------------------------------------------------
// Shared problem shape (RFC 7807)
// ---------------------------------------------------------------------------

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly importAttemptId?: string;
}

// ---------------------------------------------------------------------------
// HTTP-boundary error types
// ---------------------------------------------------------------------------

export class AuthenticationRequiredError extends Error {
  override readonly name = 'AuthenticationRequiredError';
}

export class HttpValidationError extends Error {
  override readonly name = 'HttpValidationError';

  constructor(
    readonly field: string,
    readonly code: 'REQUIRED' | 'INVALID_FORMAT' | 'INVALID_TYPE' | 'OUT_OF_RANGE',
  ) {
    super(`HTTP validation failed: ${field} ${code}`);
  }
}

export class AgendaUploadTooLargeError extends Error {
  override readonly name = 'AgendaUploadTooLargeError';
}

export class AgendaArtifactUnsupportedError extends Error {
  override readonly name = 'AgendaArtifactUnsupportedError';
}

export class AgendaLayoutRejectedError extends Error {
  override readonly name = 'AgendaLayoutRejectedError';

  constructor(readonly importAttemptId: string) {
    super('Agenda layout rejected');
  }
}

export class AgendaImportTimeoutError extends Error {
  override readonly name = 'AgendaImportTimeoutError';

  constructor(readonly importAttemptId: string) {
    super('Agenda import timed out');
  }
}

// ---------------------------------------------------------------------------
// Application-error → HTTP mapping table
// ---------------------------------------------------------------------------

const AGENDA_APPLICATION_PROBLEMS: Record<
  string,
  { status: number; title: string; type: string; detail: string }
> = {
  PERMISSION_DENIED: {
    status: 403,
    title: 'Forbidden',
    type: 'https://sigac/errors/permission-denied',
    detail: 'The authenticated actor is not allowed to perform this operation.',
  },
  AGENDA_IMPORT_NOT_FOUND: {
    status: 404,
    title: 'Not Found',
    type: 'https://sigac/errors/agenda-import-not-found',
    detail: 'The requested importación de Agenda was not found.',
  },
  AGENDA_NOT_FOUND: {
    status: 404,
    title: 'Not Found',
    type: 'https://sigac/errors/agenda-not-found',
    detail: 'The requested Agenda was not found for this date.',
  },
  IDEMPOTENCY_KEY_REUSED: {
    status: 409,
    title: 'Conflict',
    type: 'https://sigac/errors/idempotency-key-reused',
    detail: 'The Idempotency-Key was already used with a different artifact.',
  },
  // T-23 preparation-reports REQ-PR-002 §6
  NO_ACTIVE_APPOINTMENTS: {
    status: 422,
    title: 'Unprocessable Content',
    type: 'https://sigac/errors/no-active-appointments',
    detail: 'No hay citas activas para los servicios solicitados en esta fecha.',
  },
};

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

@Injectable()
export class AgendaApiProblemMapper {
  /**
   * Maps a thrown error to an HttpException with a sanitised RFC 7807 body.
   * Returns null for unknown errors (caller decides fallback).
   */
  toHttpException(error: unknown, importAttemptId?: string): HttpException | null {
    // ---- HTTP validation errors (400) ----
    if (error instanceof HttpValidationError) {
      return new HttpException(
        {
          type: 'https://sigac/errors/http-validation',
          title: 'Invalid request',
          status: 400,
          code: 'HTTP_VALIDATION_ERROR',
          detail: 'The request contains invalid or malformed values.',
          errors: [{ field: error.field, code: error.code }],
        } satisfies ProblemDetails & { errors: unknown },
        400,
      );
    }

    // ---- Authentication (401) ----
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

    // ---- Upload too large (413) ----
    if (error instanceof AgendaUploadTooLargeError) {
      return new HttpException(
        {
          type: 'https://sigac/errors/agenda-upload-too-large',
          title: 'Payload Too Large',
          status: 413,
          code: 'AGENDA_UPLOAD_TOO_LARGE',
          ...(importAttemptId !== undefined ? { importAttemptId } : {}),
        } satisfies ProblemDetails,
        413,
      );
    }

    // ---- Unsupported extension (415) ----
    if (error instanceof AgendaArtifactUnsupportedError) {
      return new HttpException(
        {
          type: 'https://sigac/errors/agenda-artifact-unsupported',
          title: 'Unsupported Media Type',
          status: 415,
          code: 'AGENDA_ARTIFACT_UNSUPPORTED',
        } satisfies ProblemDetails,
        415,
      );
    }

    // ---- Layout rejected — boundary-level wrapper (422) ----
    if (error instanceof AgendaLayoutRejectedError) {
      return new HttpException(
        {
          type: 'https://sigac/errors/agenda-layout-rejected',
          title: 'Unprocessable Content',
          status: 422,
          code: 'AGENDA_LAYOUT_REJECTED',
          importAttemptId: error.importAttemptId,
        } satisfies ProblemDetails,
        422,
      );
    }

    // ---- LayoutRejectedError thrown by the application use case (422) ----
    if (error instanceof LayoutRejectedError) {
      return new HttpException(
        {
          type: 'https://sigac/errors/agenda-layout-rejected',
          title: 'Unprocessable Content',
          status: 422,
          code: 'AGENDA_LAYOUT_REJECTED',
          ...(importAttemptId !== undefined ? { importAttemptId } : {}),
        } satisfies ProblemDetails,
        422,
      );
    }

    // ---- Import timeout (504) ----
    if (error instanceof AgendaImportTimeoutError) {
      return new HttpException(
        {
          type: 'https://sigac/errors/agenda-import-timeout',
          title: 'Gateway Timeout',
          status: 504,
          code: 'AGENDA_IMPORT_TIMEOUT',
          importAttemptId: error.importAttemptId,
        } satisfies ProblemDetails,
        504,
      );
    }

    // ---- Application errors from use cases ----
    if (error instanceof ApplicationError) {
      const problem = AGENDA_APPLICATION_PROBLEMS[error.code];
      if (problem !== undefined) {
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
    }

    return null;
  }
}
