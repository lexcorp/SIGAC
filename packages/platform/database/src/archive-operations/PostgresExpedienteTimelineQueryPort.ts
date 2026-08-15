import type {
  ExpedienteId,
  ExpedienteTimelineQueryPort,
  MovimientoExpedienteSummary,
  TimelinePage,
  TimelinePagination,
} from '@sigac/archive-operations';
import type { TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter } from '../TenantDatabaseRouter.js';

interface TimelineCursor { readonly occurredAt: string; readonly movimientoId: string }

interface MovimientoRow {
  id: string; movement_type: string; origin_location_id: string | null;
  destination_location_id: string | null; origin_custodian_ref: string | null;
  destination_custodian_ref: string | null; business_reference_type: string;
  business_reference_id: string | null; occurred_at: Date; recorded_at: Date;
  actor_ref: string; source: string; correlation_id: string | null;
}

export class PostgresExpedienteTimelineQueryPort implements ExpedienteTimelineQueryPort {
  constructor(private readonly router: TenantDatabaseRouter) {}

  async findByExpediente(
    expedienteId: ExpedienteId,
    pagination: TimelinePagination,
    tenant: TenantContext,
  ): Promise<TimelinePage> {
    if (!Number.isInteger(pagination.limit) || pagination.limit <= 0) {
      throw new RangeError('TimelinePagination.limit debe ser un entero positivo.');
    }
    const cursor = pagination.cursor ? this.decodeCursor(pagination.cursor) : null;
    return this.router.withClient(tenant, async ({ client }) => {
      const values: unknown[] = [expedienteId.value];
      let cursorClause = '';
      if (cursor) {
        values.push(cursor.occurredAt, cursor.movimientoId);
        cursorClause = 'AND (occurred_at, id) < ($2::timestamptz, $3::uuid)';
      }
      values.push(pagination.limit + 1);
      const result = await client.query<MovimientoRow>(
        `SELECT id, movement_type, origin_location_id, destination_location_id,
          origin_custodian_ref, destination_custodian_ref,
          business_reference_type, business_reference_id, occurred_at, recorded_at,
          actor_ref, source, correlation_id
        FROM movimientos_expediente
        WHERE expediente_id = $1 ${cursorClause}
        ORDER BY occurred_at DESC, id DESC
        LIMIT $${values.length}`,
        values,
      );
      const hasNext = result.rows.length > pagination.limit;
      const rows = result.rows.slice(0, pagination.limit);
      return {
        items: rows.map(this.toSummary),
        nextCursor: hasNext && rows.length > 0 ? this.encodeCursor(rows[rows.length - 1]!) : null,
      };
    });
  }

  private readonly toSummary = (row: MovimientoRow): MovimientoExpedienteSummary => ({
    movimientoId: row.id,
    movementType: row.movement_type,
    originLocation: row.origin_location_id,
    destinationLocation: row.destination_location_id,
    originCustodianRef: row.origin_custodian_ref,
    destinationCustodianRef: row.destination_custodian_ref,
    businessReferenceType: row.business_reference_type,
    businessReferenceId: row.business_reference_id,
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
    actorRef: row.actor_ref,
    source: row.source,
    correlationId: row.correlation_id,
  });

  private encodeCursor(row: MovimientoRow): string {
    return Buffer.from(JSON.stringify({
      occurredAt: row.occurred_at.toISOString(), movimientoId: row.id,
    } satisfies TimelineCursor)).toString('base64url');
  }

  private decodeCursor(cursor: string): TimelineCursor {
    try {
      const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as TimelineCursor;
      if (!value.occurredAt || !value.movimientoId || Number.isNaN(Date.parse(value.occurredAt))) {
        throw new Error('invalid');
      }
      return value;
    } catch {
      throw new RangeError('TimelinePagination.cursor inválido.');
    }
  }
}
