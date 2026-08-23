import {
  ImportacionAgendaId,
  type IdempotencyKeyRepository,
} from '@sigac/agenda-preparation';
import type { TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter, TenantDatabaseSession } from '../TenantDatabaseRouter.js';
import { TenantSessionExecutor } from '../internal/TenantSessionExecutor.js';

export class PostgresIdempotencyKeyRepository implements IdempotencyKeyRepository {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter, session?: TenantDatabaseSession) {
    this.executor = new TenantSessionExecutor(router, session);
  }

  async findByKey(
    key: string,
    tenant: TenantContext,
  ): Promise<{ readonly importacionId: ImportacionAgendaId } | null> {
    return this.executor.execute(tenant, async ({ client }) => {
      const result = await client.query<{ importacion_id: string }>(
        `SELECT importacion_id FROM agenda_idempotency_keys WHERE idempotency_key = $1`,
        [key],
      );
      if (result.rows.length === 0) return null;
      return { importacionId: ImportacionAgendaId.parse(result.rows[0].importacion_id) };
    });
  }

  async recordKey(
    key: string,
    importacionId: ImportacionAgendaId,
    tenant: TenantContext,
  ): Promise<void> {
    await this.executor.execute(tenant, async ({ client }) => {
      await client.query(
        `INSERT INTO agenda_idempotency_keys (idempotency_key, importacion_id)
         VALUES ($1, $2)`,
        [key, importacionId.value],
      );
    });
  }
}
