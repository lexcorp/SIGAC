import type { RequestSource, TenantContext } from '@sigac/tenant';
import type { AuditResult } from '@sigac/audit';
import type { ExpedienteId } from '../domain/value-objects/ExpedienteId.js';

export interface ExpedienteAuditPagination {
  readonly cursor?: string;
  readonly limit: number;
}

export interface ExpedienteAuditEntrySummary {
  readonly auditId: string;
  readonly action: string;
  readonly result: AuditResult;
  readonly actorRef: string;
  readonly occurredAt: Date;
  readonly source: RequestSource;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface ExpedienteAuditPage {
  readonly items: readonly ExpedienteAuditEntrySummary[];
  readonly nextCursor: string | null;
}

export interface ExpedienteAuditQueryPort {
  findByExpediente(
    expedienteId: ExpedienteId,
    pagination: ExpedienteAuditPagination,
    tenant: TenantContext,
  ): Promise<ExpedienteAuditPage>;
}
