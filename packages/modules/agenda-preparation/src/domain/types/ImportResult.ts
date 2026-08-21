export const IMPORT_OUTCOMES = ['IMPORTED', 'ALREADY_IMPORTED', 'RECONCILED'] as const;
export type ImportOutcome = (typeof IMPORT_OUTCOMES)[number];

export const RECORD_PROCESSING_RESULTS = [
  'ADDED',
  'UPDATED',
  'UNCHANGED',
  'RESTORED',
  'PENDING_REVIEW',
  'REJECTED',
  'DUPLICATE_FOLIO',
] as const;
export type RecordProcessingResult = (typeof RECORD_PROCESSING_RESULTS)[number];

export const IMPORT_INCIDENTS = [
  'PHYSICIAN_NOT_RESOLVED',
  'PHYSICIAN_AMBIGUOUS',
  'SERVICE_NOT_RESOLVED',
  'EXPEDIENT_NOT_RESOLVED',
  'REQUIRED_DATA_MISSING',
  'ROW_INCONSISTENT',
  'DUPLICATE_FOLIO_IN_SNAPSHOT',
] as const;
export type ImportIncident = (typeof IMPORT_INCIDENTS)[number];
