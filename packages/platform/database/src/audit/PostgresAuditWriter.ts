import { randomUUID } from 'node:crypto';
import type { AuditEntry, AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { TenantDatabaseRouter, TenantDatabaseSession } from '../TenantDatabaseRouter.js';

const FORBIDDEN_METADATA_KEY = /(token|cookie|secret|password|connection.?string|stack|sql|patient|paciente|curp|issste|clinical|clinico|clínico)/i;

export class UnsafeAuditMetadataError extends Error {
  readonly name = 'UnsafeAuditMetadataError';
}

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
    assertSafeMetadata(entry.changeSummary);
    assertSafeMetadata(this.securityContext);
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

function assertSafeMetadata(value: unknown): void {
  if (value === null || value === undefined || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_METADATA_KEY.test(key)) {
      throw new UnsafeAuditMetadataError('Audit metadata contiene una clave no permitida.');
    }
    assertSafeMetadata(nested);
  }
}
