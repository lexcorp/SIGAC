/**
 * PostgresValeBatchUnitOfWork — T-04
 *
 * Implementa ValeBatchUnitOfWork para @sigac/vale-archivo.
 *
 * Toda la operación se ejecuta dentro de una única transacción PostgreSQL
 * tenant-local (TenantDatabaseRouter.withTransaction). Si cualquier write
 * falla el ROLLBACK automático garantiza atomicidad completa.
 *
 * Orden de writes dentro de la transacción (ADR-0040):
 *   1. findBySource      — SELECT FOR SHARE (idempotency check)
 *   2. reserveDailySequence — UPSERT RETURNING (numeración atómica ADR-0035)
 *   3. saveVale          — INSERT vale_archivo + items (via PostgresValeArchivoRepository)
 *   4. appendTraceSnapshot  — INSERT vale_generation_trace
 *   5. INSERT vale_generation_batch  (último — confirma la sesión completa; UNIQUE = segunda defensa)
 *   6. auditWriter.append  — INSERT audit_log
 *
 * Sin tenant_id en tablas (ADR-0034).
 */

import { randomUUID } from 'node:crypto';
import type {
  ValeBatchIdempotencyKey,
  ValeBatchTraceSnapshot,
  ValeBatchTransaction,
  ValeBatchUnitOfWork,
  ExistingGeneratedVale,
} from '@sigac/vale-archivo';
import type { ValeArchivo } from '@sigac/vale-archivo';
import type { AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { TenantDatabaseRouter, TenantDatabaseSession } from '../TenantDatabaseRouter.js';
import { TenantSessionExecutor } from '../internal/TenantSessionExecutor.js';
import { PostgresValeArchivoRepository } from './PostgresValeArchivoRepository.js';

// ── Row types ─────────────────────────────────────────────────────────────────

interface ExistingValeRow {
  vale_id: string;
  numero_vale: string;
  agenda_date: string;
  servicio_codigo: string;
  medico_numero_empleado: string;
}

// ── UnitOfWork implementation ─────────────────────────────────────────────────

export class PostgresValeBatchUnitOfWork implements ValeBatchUnitOfWork {
  constructor(
    private readonly router: TenantDatabaseRouter,
    private readonly auditWriterFactory: (session: TenantDatabaseSession) => AuditWriter,
  ) {}

  async execute<T>(
    context: RequestContext,
    work: (transaction: ValeBatchTransaction) => Promise<T>,
  ): Promise<T> {
    return this.router.withTransaction(context.tenant, async (session) => {
      const operationOccurredAt = new Date();

      // Build session-scoped repository (shares the open connection)
      const valeRepo = new PostgresValeArchivoRepository(this.router, session);
      const auditWriter = this.auditWriterFactory(session);

      const tx: ValeBatchTransaction = {
        operationOccurredAt,
        auditWriter,

        // ── 1. Idempotency lookup ─────────────────────────────────────────
        async findBySource(key: ValeBatchIdempotencyKey): Promise<readonly ExistingGeneratedVale[]> {
          const result = await session.client.query<ExistingValeRow>(
            `SELECT
               t.vale_id,
               t.numero_vale,
               t.agenda_date::text,
               t.servicio_codigo,
               t.medico_numero_empleado
             FROM vale_generation_batch b
             JOIN vale_generation_trace t ON t.batch_id = b.id
             WHERE b.agenda_date       = $1
               AND b.source_importacion_id   = $2
               AND b.generation_snapshot_hash = $3
             FOR SHARE`,
            [key.agendaDate, key.sourceImportacionId, key.generationSnapshotHash],
          );
          return result.rows.map((row) => ({
            valeId:               row.vale_id,
            numeroVale:           row.numero_vale,
            agendaDate:           row.agenda_date,
            servicioCodigo:       row.servicio_codigo,
            medicoNumeroEmpleado: row.medico_numero_empleado,
          }));
        },

        // ── 2. Atomic daily sequence (ADR-0035) ───────────────────────────
        async reserveDailySequence(fechaSolicitud: string): Promise<number> {
          const result = await session.client.query<{ last_sequence: number }>(
            `INSERT INTO vale_daily_sequence (fecha_solicitud, last_sequence)
             VALUES ($1, 1)
             ON CONFLICT (fecha_solicitud)
               DO UPDATE SET last_sequence = vale_daily_sequence.last_sequence + 1
             RETURNING last_sequence`,
            [fechaSolicitud],
          );
          return result.rows[0]!.last_sequence;
        },

        // ── 3. Save Vale + items ──────────────────────────────────────────
        async saveVale(vale: ValeArchivo): Promise<void> {
          await valeRepo.save(vale, context.tenant);
        },

        // ── 4. Append trace snapshot (ADR-0040) ───────────────────────────
        // Collected in the local `pendingTraces` array; the batch INSERT (step 5)
        // happens after all application-layer work completes.
        async appendTraceSnapshot(snapshot: ValeBatchTraceSnapshot): Promise<void> {
          pendingTraces.push(snapshot);
        },
      };

      const pendingTraces: ValeBatchTraceSnapshot[] = [];

      // Execute the application-layer work
      const result = await work(tx);

      // ── 5. Insert batch row + traces (all or nothing with the transaction)
      const resolvedPendingTraces = pendingTraces;

      if (resolvedPendingTraces.length > 0) {
        // Insert the batch identity row (UNIQUE constraint = second defense vs concurrency)
        const firstSnapshot = resolvedPendingTraces[0]!;
        const batchResult = await session.client.query<{ id: string }>(
          `INSERT INTO vale_generation_batch
             (id, agenda_date, source_importacion_id, source_version,
              generation_snapshot_hash, actor_id, generated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            randomUUID(),
            firstSnapshot.source.agendaDate,
            firstSnapshot.source.sourceImportacionId,
            firstSnapshot.source.sourceVersion,
            firstSnapshot.source.generationSnapshotHash,
            context.actor.actorId,
            operationOccurredAt,
          ],
        );
        const batchId = batchResult.rows[0]!.id;

        // Insert one trace per generated Vale
        for (const snapshot of resolvedPendingTraces) {
          await session.client.query(
            `INSERT INTO vale_generation_trace
               (id, batch_id, vale_id, numero_vale, agenda_date,
                servicio_codigo, servicio_nombre,
                medico_numero_empleado, medico_nombre,
                items, resolved_conflicts)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              randomUUID(),
              batchId,
              snapshot.valeId,
              snapshot.numeroVale,
              snapshot.agendaDate,
              snapshot.servicioCodigo,
              snapshot.servicioNombre,
              snapshot.medicoNumeroEmpleado,
              snapshot.medicoNombre,
              JSON.stringify(snapshot.items),
              JSON.stringify(snapshot.resolvedConflicts),
            ],
          );
        }
      }

      return result;
    });
  }
}
