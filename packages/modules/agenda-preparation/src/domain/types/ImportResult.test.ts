import { describe, expect, it } from 'vitest';
import { IMPORT_INCIDENTS, IMPORT_OUTCOMES, RECORD_PROCESSING_RESULTS } from './ImportResult.js';

describe('closed import result taxonomies', () => {
  it('defines exact ImportOutcome values', () => expect(IMPORT_OUTCOMES).toEqual(['IMPORTED', 'ALREADY_IMPORTED', 'RECONCILED']));
  it('defines exact RecordProcessingResult values', () => expect(RECORD_PROCESSING_RESULTS).toEqual(['ADDED', 'UPDATED', 'UNCHANGED', 'RESTORED', 'PENDING_REVIEW', 'REJECTED', 'DUPLICATE_FOLIO']));
  it('defines exact ImportIncident values', () => expect(IMPORT_INCIDENTS).toEqual(['PHYSICIAN_NOT_RESOLVED', 'PHYSICIAN_AMBIGUOUS', 'SERVICE_NOT_RESOLVED', 'EXPEDIENT_NOT_RESOLVED', 'REQUIRED_DATA_MISSING', 'ROW_INCONSISTENT', 'DUPLICATE_FOLIO_IN_SNAPSHOT']));
});
