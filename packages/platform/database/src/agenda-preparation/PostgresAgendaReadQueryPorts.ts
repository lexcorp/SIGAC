/**
 * PostgresAgendaReadQueryPorts.ts
 *
 * Implements the three read-side query ports for Agenda Preparation:
 *   - AgendaDayQueryPort      → GetAgendaDaySummary
 *   - AgendaImportHistoryQueryPort → ListAgendaImports
 *   - PreparationListQueryPort → GetAgendaPreparationList / PrintAgendaPreparationList
 *
 * Root cause of the bug these adapters fix: dev-composition-root.ts wired null
 * adapters (returning empty / null unconditionally) for all read queries, while
 * the write path used real Postgres adapters via PostgresAgendaPreparationUnitOfWork.
 * Result: POST /agenda-imports wrote data correctly but GET /agendas/:date and
 * GET /agenda-imports always returned 404 / empty despite data being in the DB.
 */

import type {
  AgendaDayQueryPort,
  AgendaDayReadModel,
  AgendaImportHistoryPage,
  AgendaImportHistoryQueryPort,
  AgendaImportIncidentSummary,
  AgendaImportIncidentsQueryPort,
  PreparationItem,
  PreparationListQueryPort,
  PreparationOrder,
  PreparationPage,
  PreparationPagination,
} from '@sigac/agenda-preparation';
import type { AgendaFecha, ImportacionAgendaId } from '@sigac/agenda-preparation';
import type { TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter } from '../TenantDatabaseRouter.js';
import { TenantSessionExecutor } from '../internal/TenantSessionExecutor.js';

// ─── AgendaDayQueryPort ──────────────────────────────────────────────────────

interface AgendaImportRow {
  id: string;
  imported_at: Date;
  outcome: string;
  incidents: string;
}

interface CitaCountRow {
  active_count: string;
  physician_count: string;
  service_count: string;
}

export class PostgresAgendaDayQueryPort implements AgendaDayQueryPort {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter) {
    this.executor = new TenantSessionExecutor(router);
  }

  async findByDate(
    fecha: AgendaFecha,
    tenant: TenantContext,
  ): Promise<AgendaDayReadModel | null> {
    return this.executor.execute(tenant, async ({ client }) => {
      // Get the most recent import for this date
      const importResult = await client.query<AgendaImportRow>(
        `SELECT id, imported_at, outcome, incidents
         FROM agenda_imports
         WHERE agenda_date = $1
         ORDER BY imported_at DESC
         LIMIT 1`,
        [fecha.value],
      );

      if (importResult.rows.length === 0) return null;
      const latestImport = importResult.rows[0]!;

      // Count active citas, unique physicians, unique services for this date
      const citaResult = await client.query<CitaCountRow>(
        `SELECT
           COUNT(*) FILTER (WHERE lifecycle = 'ACTIVA')         AS active_count,
           COUNT(DISTINCT medico_numero_empleado)
             FILTER (WHERE lifecycle = 'ACTIVA')                AS physician_count,
           COUNT(DISTINCT servicio_codigo)
             FILTER (WHERE lifecycle = 'ACTIVA')                AS service_count
         FROM citas
         WHERE agenda_date = $1`,
        [fecha.value],
      );

      const counts = citaResult.rows[0]!;

      return {
        agendaDate:           fecha.value,
        latestImportacionId:  latestImport.id,
        latestImportedAt:     latestImport.imported_at,
        latestOutcome:        latestImport.outcome as AgendaDayReadModel['latestOutcome'],
        activeAppointments:   parseInt(counts.active_count, 10),
        physicians:           parseInt(counts.physician_count, 10),
        services:             parseInt(counts.service_count, 10),
        incidentCount:        parseInt(latestImport.incidents, 10),
      };
    });
  }
}

// ─── AgendaImportHistoryQueryPort ────────────────────────────────────────────

interface ImportHistoryRow {
  id: string;
  agenda_date: string;
  imported_at: Date;
  outcome: string;
  received_records: string;
  processed: string;
  added: string;
  updated: string;
  unchanged: string;
  restored: string;
  pending_review: string;
  rejected: string;
  duplicate_folio: string;
  withdrawn_from_agenda: string;
  incidents: string;
  errors: string;
}

export class PostgresAgendaImportHistoryQueryPort implements AgendaImportHistoryQueryPort {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter) {
    this.executor = new TenantSessionExecutor(router);
  }

  async findAll(
    agendaDate: string | undefined,
    pagination: { readonly cursor?: string; readonly limit: number },
    tenant: TenantContext,
  ): Promise<AgendaImportHistoryPage> {
    return this.executor.execute(tenant, async ({ client }) => {
      // cursor = the imported_at timestamp of the last seen item (ISO string)
      // Items are ordered by imported_at DESC, id DESC (stable tiebreak)
      const params: unknown[] = [pagination.limit + 1];
      const conditions: string[] = [];

      if (agendaDate !== undefined) {
        params.push(agendaDate);
        conditions.push(`agenda_date = $${params.length}`);
      }

      if (pagination.cursor !== undefined) {
        // cursor format: "<imported_at_iso>|<id>"
        const [cursorTs, cursorId] = pagination.cursor.split('|');
        if (cursorTs && cursorId) {
          params.push(cursorTs, cursorId);
          const tsIdx = params.length - 1;
          const idIdx = params.length;
          conditions.push(
            `(imported_at < $${tsIdx} OR (imported_at = $${tsIdx} AND id < $${idIdx}))`,
          );
        }
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await client.query<ImportHistoryRow>(
        `SELECT id, agenda_date, imported_at, outcome,
                received_records, processed, added, updated, unchanged, restored,
                pending_review, rejected, duplicate_folio, withdrawn_from_agenda,
                incidents, errors
         FROM agenda_imports
         ${where}
         ORDER BY imported_at DESC, id DESC
         LIMIT $1`,
        params,
      );

      const rows = result.rows;
      const hasMore = rows.length > pagination.limit;
      const items = (hasMore ? rows.slice(0, pagination.limit) : rows).map((row) => ({
        importacionId: row.id,
        agendaDate:    row.agenda_date,
        importedAt:    row.imported_at,
        outcome:       row.outcome as AgendaImportHistoryPage['items'][0]['outcome'],
        metrics: {
          receivedRecords:      parseInt(row.received_records,      10),
          processed:            parseInt(row.processed,            10),
          added:                parseInt(row.added,                10),
          updated:              parseInt(row.updated,              10),
          unchanged:            parseInt(row.unchanged,            10),
          restored:             parseInt(row.restored,             10),
          pendingReview:        parseInt(row.pending_review,       10),
          rejected:             parseInt(row.rejected,             10),
          duplicateFolio:       parseInt(row.duplicate_folio,      10),
          withdrawnFromAgenda:  parseInt(row.withdrawn_from_agenda,10),
          incidents:            parseInt(row.incidents,            10),
          errors:               parseInt(row.errors,               10),
        },
      }));

      let nextCursor: string | null = null;
      if (hasMore && items.length > 0) {
        const last = items[items.length - 1]!;
        nextCursor = `${last.importedAt.toISOString()}|${last.importacionId}`;
      }

      return { items, nextCursor };
    });
  }
}

// ─── PreparationListQueryPort ────────────────────────────────────────────────

interface PreparationRow {
  folio: string;
  nombre_paciente: string;
  expediente_reference: string | null;
  orig_expediente: string | null;
  tipo_derechohabiente: string;
  tipo_consulta: string;
  agenda_date: string;
  hora: string;
  medico_numero_empleado: string;
  medico_nombre: string;
  servicio_codigo: string;
  servicio_nombre: string;
}

function orderClause(order: PreparationOrder): string {
  switch (order) {
    case 'APPOINTMENT_TIME_ASC': return 'hora ASC, folio ASC';
    case 'PATIENT_NAME_ASC':     return 'nombre_paciente ASC, folio ASC';
  }
}

function rowToItem(row: PreparationRow): PreparationItem {
  return {
    folio:              row.folio,
    nombrePaciente:     row.nombre_paciente,
    expediente: {
      original:  row.orig_expediente ?? row.folio,
      reference: row.expediente_reference,
    },
    tipoDerechohabiente: row.tipo_derechohabiente,
    tipoConsulta:        row.tipo_consulta as 'FIRST_TIME' | 'SUBSEQUENT',
    agendaDate:          row.agenda_date,
    appointmentTime:     row.hora,
    medico: {
      numeroEmpleado: row.medico_numero_empleado,
      nombre:         row.medico_nombre,
    },
    servicioEspecialidad: {
      codigo: row.servicio_codigo,
      nombre: row.servicio_nombre,
    },
  };
}

export class PostgresAgendaPreparationQueryPort implements PreparationListQueryPort {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter) {
    this.executor = new TenantSessionExecutor(router);
  }

  async findPage(
    agendaDate: AgendaFecha,
    order: PreparationOrder,
    pagination: PreparationPagination,
    tenant: TenantContext,
  ): Promise<PreparationPage> {
    return this.executor.execute(tenant, async ({ client }) => {
      const params: unknown[] = [agendaDate.value, pagination.limit + 1];
      let cursorCondition = '';

      if (pagination.cursor !== undefined) {
        // cursor = base64-encoded "<hora>|<folio>" for time-order, or "<nombre>|<folio>"
        let decoded: string;
        try {
          decoded = Buffer.from(pagination.cursor, 'base64').toString('utf8');
        } catch {
          decoded = '';
        }
        const [cursorA, cursorB] = decoded.split('|');
        if (cursorA && cursorB) {
          params.push(cursorA, cursorB);
          const aIdx = params.length - 1;
          const bIdx = params.length;
          if (order === 'APPOINTMENT_TIME_ASC') {
            cursorCondition = `AND (hora > $${aIdx} OR (hora = $${aIdx} AND folio > $${bIdx}))`;
          } else {
            cursorCondition = `AND (nombre_paciente > $${aIdx} OR (nombre_paciente = $${aIdx} AND folio > $${bIdx}))`;
          }
        }
      }

      const result = await client.query<PreparationRow>(
        `SELECT c.folio, c.nombre_paciente, c.expediente_reference,
                ar.orig_expediente_reference AS orig_expediente,
                c.tipo_derechohabiente, c.tipo_consulta,
                c.agenda_date, c.hora,
                c.medico_numero_empleado, c.medico_nombre,
                c.servicio_codigo, c.servicio_nombre
         FROM citas c
         LEFT JOIN LATERAL (
           SELECT ar2.orig_expediente_reference
           FROM agenda_registros ar2
           JOIN agenda_imports ai ON ai.id = ar2.importacion_id
           WHERE ar2.interp_folio = c.folio
             AND ai.agenda_date = c.agenda_date
           ORDER BY ai.imported_at DESC
           LIMIT 1
         ) ar ON true
         WHERE c.agenda_date = $1
           AND c.lifecycle = 'ACTIVA'
           ${cursorCondition}
         ORDER BY ${orderClause(order)}
         LIMIT $2`,
        params,
      );

      const rows = result.rows;
      const hasMore = rows.length > pagination.limit;
      const items = (hasMore ? rows.slice(0, pagination.limit) : rows).map(rowToItem);

      let nextCursor: string | null = null;
      if (hasMore && items.length > 0) {
        const last = items[items.length - 1]!;
        const key = order === 'APPOINTMENT_TIME_ASC'
          ? `${last.appointmentTime}|${last.folio}`
          : `${last.nombrePaciente}|${last.folio}`;
        nextCursor = Buffer.from(key, 'utf8').toString('base64');
      }

      return { items, nextCursor };
    });
  }

  async listForPrint(
    agendaDate: AgendaFecha,
    order: PreparationOrder,
    tenant: TenantContext,
  ): Promise<readonly PreparationItem[]> {
    return this.executor.execute(tenant, async ({ client }) => {
      const result = await client.query<PreparationRow>(
        `SELECT c.folio, c.nombre_paciente, c.expediente_reference,
                ar.orig_expediente_reference AS orig_expediente,
                c.tipo_derechohabiente, c.tipo_consulta,
                c.agenda_date, c.hora,
                c.medico_numero_empleado, c.medico_nombre,
                c.servicio_codigo, c.servicio_nombre
         FROM citas c
         LEFT JOIN LATERAL (
           SELECT ar2.orig_expediente_reference
           FROM agenda_registros ar2
           JOIN agenda_imports ai ON ai.id = ar2.importacion_id
           WHERE ar2.interp_folio = c.folio
             AND ai.agenda_date = c.agenda_date
           ORDER BY ai.imported_at DESC
           LIMIT 1
         ) ar ON true
         WHERE c.agenda_date = $1
           AND c.lifecycle = 'ACTIVA'
         ORDER BY ${orderClause(order)}`,
        [agendaDate.value],
      );
      return result.rows.map(rowToItem);
    });
  }
}

// ─── AgendaImportIncidentsQueryPort ─────────────────────────────────────────

interface IncidentRow {
  id: string;
  registro_id: string;
  source_position: string;
  incident_type: string;
}

export class PostgresAgendaImportIncidentsQueryPort implements AgendaImportIncidentsQueryPort {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter) {
    this.executor = new TenantSessionExecutor(router);
  }

  async findByImportacionId(
    importacionId: ImportacionAgendaId,
    tenant: TenantContext,
  ): Promise<readonly AgendaImportIncidentSummary[]> {
    return this.executor.execute(tenant, async ({ client }) => {
      const result = await client.query<IncidentRow>(
        `SELECT id, registro_id, source_position, incident_type
         FROM agenda_incidencias
         WHERE importacion_id = $1
         ORDER BY source_position ASC`,
        [importacionId.value],
      );
      return result.rows.map((row) => ({
        incidenciaId:   row.id,
        registroId:     row.registro_id,
        sourcePosition: parseInt(row.source_position, 10),
        type:           row.incident_type as AgendaImportIncidentSummary['type'],
      }));
    });
  }
}
