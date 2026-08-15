import type {
  ExpedienteAuditEntrySummary,
  ExpedienteAuditPage,
  ExpedienteAuditPagination,
  ExpedienteAuditQueryPort,
  ExpedienteId,
} from '@sigac/archive-operations';
import type { AuditResult } from '@sigac/archive-operations';
import type { RequestSource, TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter } from '../TenantDatabaseRouter.js';

interface AuditCursor { readonly occurredAt: string; readonly auditId: string }
interface AuditRow {
  id: string; action: string; result: AuditResult; actor_ref: string; occurred_at: Date;
  source: RequestSource; request_id: string; correlation_id: string;
}

export class PostgresExpedienteAuditQueryPort implements ExpedienteAuditQueryPort {
  constructor(private readonly router: TenantDatabaseRouter) {}

  async findByExpediente(expedienteId: ExpedienteId, pagination: ExpedienteAuditPagination, tenant: TenantContext): Promise<ExpedienteAuditPage> {
    if (!Number.isInteger(pagination.limit) || pagination.limit <= 0) throw new RangeError('ExpedienteAuditPagination.limit debe ser positivo.');
    const cursor = pagination.cursor ? this.decode(pagination.cursor) : null;
    return this.router.withClient(tenant, async ({ client }) => {
      const values: unknown[] = ['EXPEDIENTE', expedienteId.value];
      let cursorClause = '';
      if (cursor) {
        values.push(cursor.occurredAt, cursor.auditId);
        cursorClause = 'AND (occurred_at, id) < ($3::timestamptz, $4::uuid)';
      }
      values.push(pagination.limit + 1);
      const result = await client.query<AuditRow>(
        `SELECT id, action, result, actor_ref, occurred_at, source, request_id, correlation_id
         FROM audit_log
         WHERE resource_type = $1 AND resource_id = $2 ${cursorClause}
         ORDER BY occurred_at DESC, id DESC
         LIMIT $${values.length}`,
        values,
      );
      const hasNext = result.rows.length > pagination.limit;
      const rows = result.rows.slice(0, pagination.limit);
      return { items: rows.map(this.toSummary), nextCursor: hasNext && rows.length ? this.encode(rows.at(-1)!) : null };
    });
  }

  private readonly toSummary = (row: AuditRow): ExpedienteAuditEntrySummary => ({
    auditId: row.id, action: row.action, result: row.result, actorRef: row.actor_ref,
    occurredAt: row.occurred_at, source: row.source, requestId: row.request_id,
    correlationId: row.correlation_id,
  });

  private encode(row: AuditRow): string {
    return Buffer.from(JSON.stringify({ occurredAt: row.occurred_at.toISOString(), auditId: row.id } satisfies AuditCursor)).toString('base64url');
  }

  private decode(value: string): AuditCursor {
    try {
      const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as AuditCursor;
      if (!cursor.occurredAt || !cursor.auditId || Number.isNaN(Date.parse(cursor.occurredAt))) throw new Error('invalid');
      return cursor;
    } catch {
      throw new RangeError('ExpedienteAuditPagination.cursor inválido.');
    }
  }
}
