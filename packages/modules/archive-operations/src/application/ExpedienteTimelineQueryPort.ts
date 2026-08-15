import type { TenantContext } from '@sigac/tenant';
import type { ExpedienteId } from '../domain/value-objects/ExpedienteId.js';

export interface TimelinePagination {
  readonly cursor?: string;
  readonly limit: number;
}

export interface MovimientoExpedienteSummary {
  readonly movimientoId: string;
  readonly movementType: string;
  readonly originLocation: string | null;
  readonly destinationLocation: string | null;
  readonly originCustodianRef: string | null;
  readonly destinationCustodianRef: string | null;
  readonly businessReferenceType: string;
  readonly businessReferenceId: string | null;
  readonly occurredAt: Date;
  readonly recordedAt: Date;
  readonly actorRef: string;
  readonly source: string;
  readonly correlationId: string | null;
}

export interface TimelinePage {
  readonly items: readonly MovimientoExpedienteSummary[];
  readonly nextCursor: string | null;
}

export interface ExpedienteTimelineQueryPort {
  findByExpediente(
    expedienteId: ExpedienteId,
    pagination: TimelinePagination,
    tenant: TenantContext,
  ): Promise<TimelinePage>;
}
