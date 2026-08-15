import { randomUUID } from 'node:crypto';
import type { AuditEntry, AuditWriter } from '@sigac/archive-operations';
import type { RequestContext } from '@sigac/tenant';
import type { TenantDatabaseRouter, TenantDatabaseSession } from '../TenantDatabaseRouter.js';

export class PostgresAuditWriter implements AuditWriter {
  constructor(
    private readonly router: TenantDatabaseRouter,
    private readonly session?: TenantDatabaseSession,
    private readonly securityContext: Readonly<Record<string, unknown>> | null = null,
  ) {}

  append(entry: AuditEntry, context: RequestContext): Promise<void> {
    if (this.session) {
      this.router.assertSessionTenant(this.session, context.tenant);
      return this.insert(this.session, entry, context);
    }
    return this.router.withTransaction(context.tenant, (session) => this.insert(session, entry, context));
  }

  private async insert(
    session: TenantDatabaseSession,
    entry: AuditEntry,
    context: RequestContext,
  ): Promise<void> {
    await session.client.query(
      `INSERT INTO audit_log (
        id, actor_ref, action, resource_type, resource_id, result,
        request_id, correlation_id, source, occurred_at, change_summary, security_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)`,
      [
        randomUUID(),
        context.actor.actorId,
        entry.action,
        entry.resourceType,
        entry.resourceId,
        entry.result,
        context.requestId,
        context.correlationId,
        context.source,
        new Date(),
        entry.changeSummary ? JSON.stringify(entry.changeSummary) : null,
        this.securityContext ? JSON.stringify(this.securityContext) : null,
      ],
    );
  }
}
