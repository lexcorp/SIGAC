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
      // BUG-REIMPORT fix (DB layer): only consider the prior import "equivalent"
      // if it completed with zero rejected and zero pending_review records.
      //
      // This covers both:
      //   1. New imports after the ImportAgenda.ts fix (fingerprints are not
      //      registered for incomplete imports going forward).
      //   2. Historical fingerprints that were registered before the fix —
      //      those point to imports with rejected > 0 and must not block
      //      reimportation.
      //
      // The JOIN on agenda_imports allows us to inspect the outcome without
      // changing the schema of agenda_artifact_metadata.
      const result = await client.query<{ importacion_id: string; imported_at: Date }>(
        `SELECT am.importacion_id, am.imported_at
         FROM agenda_artifact_metadata am
         JOIN agenda_imports ai ON ai.id = am.importacion_id
         WHERE am.agenda_date = $1
           AND am.fingerprint = $2
           AND ai.rejected       = 0
           AND ai.pending_review = 0
         ORDER BY am.imported_at DESC, am.importacion_id DESC
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
