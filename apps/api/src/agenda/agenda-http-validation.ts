import { z } from 'zod';
import { AgendaFecha, ImportacionAgendaId, type PreparationOrder } from '@sigac/agenda-preparation';
import { HttpValidationError } from './agenda-api-errors.js';

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

export function parseAgendaDate(value: unknown, field = 'date'): AgendaFecha {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    throw new HttpValidationError(field, 'REQUIRED');
  }
  if (typeof value !== 'string') {
    throw new HttpValidationError(field, 'INVALID_TYPE');
  }
  try {
    return AgendaFecha.parse(value.trim());
  } catch {
    throw new HttpValidationError(field, 'INVALID_FORMAT');
  }
}

// ---------------------------------------------------------------------------
// Idempotency-Key header
// ---------------------------------------------------------------------------

export function parseIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    throw new HttpValidationError('Idempotency-Key', 'REQUIRED');
  }
  if (typeof value !== 'string') {
    throw new HttpValidationError('Idempotency-Key', 'INVALID_TYPE');
  }
  return value.trim();
}

// ---------------------------------------------------------------------------
// ImportacionAgenda ID path param
// ---------------------------------------------------------------------------

export function parseImportacionId(value: unknown, field = 'id'): ImportacionAgendaId {
  const result = z.string().uuid().safeParse(value);
  if (result.success) {
    return ImportacionAgendaId.parse(result.data);
  }
  throw new HttpValidationError(
    field,
    value === undefined ? 'REQUIRED' : typeof value === 'string' ? 'INVALID_FORMAT' : 'INVALID_TYPE',
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export function parsePaginationLimit(value: unknown, field = 'limit'): number {
  if (value === undefined || value === null) {
    throw new HttpValidationError(field, 'REQUIRED');
  }
  const text = typeof value === 'string' ? value : String(value);
  const num = parseInt(text, 10);
  if (isNaN(num) || num <= 0 || !Number.isSafeInteger(num)) {
    throw new HttpValidationError(field, 'OUT_OF_RANGE');
  }
  return num;
}

export function parseOptionalCursor(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new HttpValidationError('cursor', 'INVALID_TYPE');
  return value as PreparationOrder;
}

// ---------------------------------------------------------------------------
// Preparation order
// ---------------------------------------------------------------------------

export function parsePreparationOrder(value: unknown): PreparationOrder {
  if (value === undefined || value === null || value === '') return 'SERVICE_MEDICO_HORA_ASC';
  const validOrders = ['APPOINTMENT_TIME_ASC', 'PATIENT_NAME_ASC', 'SERVICE_MEDICO_HORA_ASC'];
  if (!validOrders.includes(value as string)) {
    throw new HttpValidationError('order', 'INVALID_FORMAT');
  }
  return value as PreparationOrder;
}

// ---------------------------------------------------------------------------
// Optional date filter for list
// ---------------------------------------------------------------------------

export function parseOptionalAgendaDateFilter(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new HttpValidationError('agendaDate', 'INVALID_TYPE');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new HttpValidationError('agendaDate', 'INVALID_FORMAT');
  }
  return value.trim();
}

// ---------------------------------------------------------------------------
// Services list for preparation report (T-23 REQ-PR-002)
// ---------------------------------------------------------------------------

/**
 * Parses an optional comma-separated list of service codes from a query param.
 * Returns an empty array when absent or blank (caller interprets as "all services").
 * Each code is trimmed and uppercased; empty entries are discarded.
 */
export function parseOptionalServicesList(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  if (typeof value !== 'string') throw new HttpValidationError('services', 'INVALID_TYPE');
  return value
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
}
