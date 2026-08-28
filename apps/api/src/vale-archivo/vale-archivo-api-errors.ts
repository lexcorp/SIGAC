/**
 * ValeArchivoApiProblemMapper — RFC 7807 error mapping para Vale Archivo.
 *
 * Patrón idéntico a AgendaApiProblemMapper.
 * Fuente: design.md §9.2, REQ-VA-001..REQ-VA-007, ADR-0033.
 */

import { HttpException, Injectable } from '@nestjs/common';
import { ApplicationError } from '@sigac/vale-archivo';
import { DomainError } from '@sigac/domain-kernel';

// ── RFC 7807 body shape ───────────────────────────────────────────────────────

export interface ValeArchivoProblem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
}

// ── HTTP-boundary errors ──────────────────────────────────────────────────────

export class ValeArchivoAuthenticationRequiredError extends Error {
  override readonly name = 'ValeArchivoAuthenticationRequiredError';
}

export class ValeArchivoHttpValidationError extends Error {
  override readonly name = 'ValeArchivoHttpValidationError';

  constructor(
    readonly field: string,
    readonly code: 'REQUIRED' | 'INVALID_FORMAT' | 'INVALID_TYPE',
  ) {
    super(`Vale Archivo HTTP validation failed: ${field} ${code}`);
  }
}

// ── ApplicationError → HTTP mapping ──────────────────────────────────────────

const VALE_APPLICATION_PROBLEMS: Record<
  string,
  { status: number; title: string; type: string; detail: string }
> = {
  PERMISSION_DENIED: {
    status: 403,
    title: 'Forbidden',
    type: 'https://sigac/errors/permission-denied',
    detail: 'The authenticated actor is not allowed to perform this operation.',
  },
  VALE_ARCHIVO_NOT_FOUND: {
    status: 404,
    title: 'Not Found',
    type: 'https://sigac/errors/vale-archivo-not-found',
    detail: 'El ValeArchivo solicitado no fue encontrado.',
  },
  VALE_ARCHIVO_ITEM_NOT_FOUND: {
    status: 404,
    title: 'Not Found',
    type: 'https://sigac/errors/vale-archivo-item-not-found',
    detail: 'El ítem del ValeArchivo solicitado no fue encontrado.',
  },
  // T-BUG-VA-001: duplicate numero_vale within the same tenant
  VALE_NUMERO_DUPLICADO: {
    status: 409,
    title: 'Conflict',
    type: 'https://sigac/errors/vale-numero-duplicado',
    detail: 'Ya existe un ValeArchivo con ese número de vale en este tenant.',
  },
};

// ── DomainError → HTTP mapping ────────────────────────────────────────────────

const VALE_DOMAIN_PROBLEMS: Record<
  string,
  { status: number; title: string; type: string; detail: string }
> = {
  VALE_REQUIERE_ITEMS: {
    status: 422,
    title: 'Unprocessable Content',
    type: 'https://sigac/errors/vale-requiere-items',
    detail: 'El vale debe contener al menos un ítem.',
  },
  INVALID_STATE_TRANSITION: {
    status: 422,
    title: 'Unprocessable Content',
    type: 'https://sigac/errors/invalid-state-transition',
    detail: 'La operación solicitada no es válida para el estado actual del vale.',
  },
};

// ── Mapper ────────────────────────────────────────────────────────────────────

@Injectable()
export class ValeArchivoApiProblemMapper {
  toHttpException(error: unknown): HttpException | null {
    // ── HTTP validation (400) ──────────────────────────────────────────────
    if (error instanceof ValeArchivoHttpValidationError) {
      return new HttpException(
        {
          type: 'https://sigac/errors/http-validation',
          title: 'Invalid request',
          status: 400,
          code: 'HTTP_VALIDATION_ERROR',
          detail: 'The request contains invalid or malformed values.',
          errors: [{ field: error.field, code: error.code }],
        } satisfies ValeArchivoProblem & { errors: unknown },
        400,
      );
    }

    // ── Authentication (401) ──────────────────────────────────────────────
    if (error instanceof ValeArchivoAuthenticationRequiredError) {
      return new HttpException(
        {
          type: 'https://sigac/errors/authentication-required',
          title: 'Unauthorized',
          status: 401,
          code: 'AUTHENTICATION_REQUIRED',
        } satisfies ValeArchivoProblem,
        401,
      );
    }

    // ── ApplicationError (403, 404) ──────────────────────────────────────
    if (error instanceof ApplicationError) {
      const problem = VALE_APPLICATION_PROBLEMS[error.code];
      if (problem !== undefined) {
        return new HttpException(
          {
            type: problem.type,
            title: problem.title,
            status: problem.status,
            code: error.code,
            detail: problem.detail,
          } satisfies ValeArchivoProblem,
          problem.status,
        );
      }
    }

    // ── DB concurrency: ValeNumeroDuplicadoError (second line of defense) ──
    // Thrown by PostgresValeArchivoRepository when the UNIQUE constraint fires
    // (concurrent duplicate — race condition). Maps to the same 409 as the
    // application-level VALE_NUMERO_DUPLICADO check.
    if (error instanceof Error && error.name === 'ValeNumeroDuplicadoError') {
      const p = VALE_APPLICATION_PROBLEMS['VALE_NUMERO_DUPLICADO']!;
      return new HttpException(
        {
          type: p.type, title: p.title, status: p.status,
          code: 'VALE_NUMERO_DUPLICADO', detail: p.detail,
        } satisfies ValeArchivoProblem,
        p.status,
      );
    }

    // ── DomainError (422) ─────────────────────────────────────────────────
    if (error instanceof DomainError) {
      const problem = VALE_DOMAIN_PROBLEMS[error.code];
      if (problem !== undefined) {
        return new HttpException(
          {
            type: problem.type,
            title: problem.title,
            status: problem.status,
            code: error.code,
            detail: problem.detail,
          } satisfies ValeArchivoProblem,
          problem.status,
        );
      }
    }

    return null;
  }
}
