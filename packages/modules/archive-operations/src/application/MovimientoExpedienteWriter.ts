import type { TenantContext } from '@sigac/tenant';
import type { ExpedienteId } from '../domain/value-objects/ExpedienteId.js';

export interface MovimientoExpedienteAppend {
  readonly expedienteId: ExpedienteId;
  readonly movementType: 'DISPATCHED';
  readonly originLocation: string | null;
  readonly destinationLocation: string;
  readonly originCustodianRef: string | null;
  readonly destinationCustodianRef: string;
  readonly businessReferenceType: string;
  readonly businessReferenceId: string | null;
  readonly occurredAt: Date;
  readonly actorRef: string;
  readonly source: string;
  readonly correlationId: string;
}

export interface MovimientoExpedienteWriter {
  append(
    movimiento: MovimientoExpedienteAppend,
    tenant: TenantContext,
  ): Promise<void>;
}
