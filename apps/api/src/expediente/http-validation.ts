import { z, type ZodIssue } from 'zod';
import { HttpValidationError, type HttpFieldError, type HttpFieldErrorCode } from './api-errors.js';

const requiredText = z.string();
const nullableText = z.string().nullable();
const ubicacionSchema = z.object({
  id: z.string().uuid(),
  codigo: requiredText,
  descripcion: requiredText,
}).strict();
const businessReferenceSchema = z.object({
  type: requiredText,
  id: nullableText,
}).strict();
const decimalBigintSchema = z.string().regex(/^[0-9]+$/);

export const dispatchBodySchema = z.object({
  destination: ubicacionSchema,
  intendedCustodian: z.object({
    type: requiredText,
    reference: requiredText,
  }).strict(),
  businessReference: businessReferenceSchema,
  expectedRowVersion: decimalBigintSchema,
}).strict();

export const acceptCustodyBodySchema = z.object({
  receptor: z.object({
    type: requiredText,
    reference: requiredText,
    service: nullableText,
  }).strict(),
  ubicacionDestino: ubicacionSchema,
  businessReference: businessReferenceSchema,
  expectedRowVersion: decimalBigintSchema,
}).strict();

export type DispatchHttpBody = z.infer<typeof dispatchBodySchema>;
export type AcceptCustodyHttpBody = z.infer<typeof acceptCustodyBodySchema>;

export function parseHttp<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new HttpValidationError(result.error.issues.map((issue) => toFieldError(issue, value)));
}

export function parseUuid(value: unknown, field = 'id'): string {
  const result = z.string().uuid().safeParse(value);
  if (result.success) return result.data;
  throw new HttpValidationError([{ field, code: value === undefined ? 'REQUIRED' :
    typeof value === 'string' ? 'INVALID_FORMAT' : 'INVALID_TYPE' }]);
}

export function parseTimelineLimit(value: unknown): number {
  const text = parseHttp(z.string().regex(/^[1-9][0-9]*$/), value);
  const limit = Number(text);
  if (!Number.isSafeInteger(limit)) {
    throw new HttpValidationError([{ field: 'limit', code: 'OUT_OF_RANGE' }]);
  }
  return limit;
}

function toFieldError(issue: ZodIssue, input: unknown): HttpFieldError {
  const field = issue.path.length > 0 ? issue.path.join('.') : 'request';
  let code: HttpFieldErrorCode;
  if (issue.code === 'invalid_type') {
    code = valueAtPath(input, issue.path) === undefined ? 'REQUIRED' : 'INVALID_TYPE';
  } else if (issue.code === 'too_big' || issue.code === 'too_small') {
    code = 'OUT_OF_RANGE';
  } else {
    code = 'INVALID_FORMAT';
  }
  return { field, code };
}

function valueAtPath(input: unknown, path: readonly PropertyKey[]): unknown {
  let current = input;
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = Reflect.get(current, segment);
  }
  return current;
}
