import type { RequestContext } from '@sigac/tenant';

export const AUDIT_RESULTS = ['success', 'denied', 'not-found'] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

export interface AuditEntry {
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly result: AuditResult;
  readonly changeSummary?: Readonly<Record<string, string>>;
}

export interface AuditWriter {
  append(entry: AuditEntry, context: RequestContext): Promise<void>;
}
