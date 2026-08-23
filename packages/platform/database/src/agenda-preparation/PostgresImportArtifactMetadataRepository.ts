import {
  ImportacionAgendaId,
  type AgendaFecha,
  type ImportArtifactMetadataRepository,
  type ImportEquivalentReference,
  type ImportFingerprint,
} from '@sigac/agenda-preparation';
import type { TenantContext } from '@sigac/tenant';
import { randomUUID } from 'node:crypto';
import type { TenantDatabaseRouter, TenantDatabaseSession } from '../TenantDatabaseRouter.js';
import { TenantSessionExecutor } from '../internal/TenantSessionExecutor.js';

export class PostgresImportArtifactMetadataRepository implements ImportArtifactMetadataRepository {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter, session?: TenantDatabaseSession) {
    this.executor = new TenantSessionExecutor(router, session);
  }

  async findEquivalent(
    input: { readonly agendaDate: AgendaFecha; readonly fingerprint: ImportFingerprint },
    tenant: TenantContext,
  ): Promise<ImportEquivalentReference | null> {
    return this.executor.execute(tenant, async ({ client }) => {
      const result = await client.query<{ importacion_id: string; imported_at: Date }>(
        `SELECT importacion_id, imported_at
         FROM agenda_artifact_metadata
         WHERE agenda_date = $1 AND fingerprint = $2
         ORDER BY imported_at DESC, importacion_id DESC
         LIMIT 1`,
        [input.agendaDate.value, input.fingerprint.value],
      );
      if (result.rows.length === 0) return null;
      return {
        importacionId: ImportacionAgendaId.parse(result.rows[0].importacion_id),
        importedAt: result.rows[0].imported_at,
      };
    });
  }

  async associateConfirmedImport(
    input: {
      readonly importacionId: ImportacionAgendaId;
      readonly agendaDate: AgendaFecha;
      readonly fingerprint: ImportFingerprint;
    },
    tenant: TenantContext,
  ): Promise<void> {
    await this.executor.execute(tenant, async ({ client }) => {
      // Copy imported_at from agenda_imports for the cursor index
      const importResult = await client.query<{ imported_at: Date }>(
        `SELECT imported_at FROM agenda_imports WHERE id = $1`,
        [input.importacionId.value],
      );
      const importedAt = importResult.rows[0]?.imported_at ?? new Date();
      await client.query(
        `INSERT INTO agenda_artifact_metadata (id, importacion_id, agenda_date, fingerprint, imported_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          randomUUID(),
          input.importacionId.value,
          input.agendaDate.value,
          input.fingerprint.value,
          importedAt,
        ],
      );
    });
  }
}
