import { randomUUID } from 'node:crypto';
import type {
  MovimientoExpedienteAppend,
  MovimientoExpedienteWriter,
} from '@sigac/archive-operations';
import type { TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter, TenantDatabaseSession } from '../TenantDatabaseRouter.js';
import { TenantSessionExecutor } from '../internal/TenantSessionExecutor.js';

export class PostgresMovimientoExpedienteWriter implements MovimientoExpedienteWriter {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter, session?: TenantDatabaseSession) {
    this.executor = new TenantSessionExecutor(router, session);
  }

  async append(movimiento: MovimientoExpedienteAppend, tenant: TenantContext): Promise<void> {
    await this.executor.execute(tenant, async ({ client }) => {
      await client.query(
        `INSERT INTO movimientos_expediente (
          id, expediente_id, movement_type, origin_location_id, destination_location_id,
          origin_custodian_ref, destination_custodian_ref,
          business_reference_type, business_reference_id, occurred_at,
          recorded_at, actor_ref, source, correlation_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          randomUUID(), movimiento.expedienteId.value, movimiento.movementType,
          movimiento.originLocation, movimiento.destinationLocation,
          movimiento.originCustodianRef, movimiento.destinationCustodianRef,
          movimiento.businessReferenceType, movimiento.businessReferenceId,
          movimiento.occurredAt, new Date(), movimiento.actorRef, movimiento.source,
          movimiento.correlationId,
        ],
      );
    });
  }
}
