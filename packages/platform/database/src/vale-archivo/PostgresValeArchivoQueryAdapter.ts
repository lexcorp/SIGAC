/**
 * PostgresValeArchivoQueryAdapter
 *
 * Adapter de lectura para ValeArchivo — implementa ValeArchivoQueryPort.
 *
 * Fuente: design.md §10.2, REQ-VA-003, ADR-0034.
 *
 * Cursor: base64("<created_at_iso>|<id>") — mismo patrón que AgendaImportHistory.
 * No retorna el Aggregate; retorna read models ligeros (ValeArchivoSummary, ValeArchivoSnapshot).
 * Sin lógica de negocio.
 */

import type {
  ValeArchivoPage,
  ValeArchivoPageFilter,
  ValeArchivoQueryPort,
  ValeArchivoSnapshot,
  ValeArchivoSummary,
} from '@sigac/vale-archivo';
import type { TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter } from '../TenantDatabaseRouter.js';
import { TenantSessionExecutor } from '../internal/TenantSessionExecutor.js';

export class PostgresValeArchivoQueryAdapter implements ValeArchivoQueryPort {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter) {
    this.executor = new TenantSessionExecutor(router);
  }

  // ── findPage ──────────────────────────────────────────────────────────────

  async findPage(
    filter: ValeArchivoPageFilter,
    tenant: TenantContext,
  ): Promise<ValeArchivoPage> {
    return this.executor.execute(tenant, async ({ client }) => {
      const limit = Math.min(filter.limit ?? 20, 100);
      const params: unknown[] = [limit + 1];
      const conditions: string[] = [];

      if (filter.estado !== undefined) {
        params.push(filter.estado);
        conditions.push(`estado = $${params.length}`);
      }

      if (filter.fecha !== undefined) {
        params.push(filter.fecha);
        conditions.push(`fecha_solicitud = $${params.length}`);
      }

      if (filter.unidad !== undefined) {
        params.push(`%${filter.unidad.toLowerCase()}%`);
        conditions.push(`lower(unidad_solicitante) LIKE $${params.length}`);
      }

      if (filter.cursor !== undefined) {
        const decoded = Buffer.from(filter.cursor, 'base64').toString('utf8');
        const [cursorTs, cursorId] = decoded.split('|');
        if (cursorTs && cursorId) {
          params.push(cursorTs, cursorId);
          const tsIdx = params.length - 1;
          const idIdx = params.length;
          conditions.push(
            `(v.created_at < $${tsIdx} OR (v.created_at = $${tsIdx} AND v.id < $${idIdx}))`,
          );
        }
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Subquery for item count per vale
      const result = await client.query<SummaryRow>(
        `SELECT
           v.id,
           v.numero_vale,
           v.fecha_solicitud,
           v.unidad_solicitante,
           v.solicitante_nombre,
           v.estado,
           COUNT(i.id)::int AS item_count
         FROM vale_archivo v
         LEFT JOIN vale_archivo_items i ON i.vale_id = v.id
         ${where}
         GROUP BY v.id, v.numero_vale, v.fecha_solicitud,
                  v.unidad_solicitante, v.solicitante_nombre,
                  v.estado, v.created_at
         ORDER BY v.created_at DESC, v.id DESC
         LIMIT $1`,
        params,
      );

      const rows = result.rows;
      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;

      const items: ValeArchivoSummary[] = pageRows.map((row) => ({
        id:                row.id,
        numeroVale:        row.numero_vale,
        fechaSolicitud:    row.fecha_solicitud,
        unidadSolicitante: row.unidad_solicitante,
        solicitanteNombre: row.solicitante_nombre,
        estado:            row.estado as ValeArchivoSummary['estado'],
        itemCount:         row.item_count,
      }));

      let nextCursor: string | null = null;
      if (hasMore && pageRows.length > 0) {
        // We need created_at for the cursor — fetch it from the last row
        // (included as a raw field in a separate query to avoid exposing it in the read model)
        const lastId = pageRows[pageRows.length - 1]!.id;
        const tsResult = await client.query<{ created_at: Date }>(
          `SELECT created_at FROM vale_archivo WHERE id = $1`,
          [lastId],
        );
        if (tsResult.rows.length > 0) {
          const ts = tsResult.rows[0]!.created_at.toISOString();
          nextCursor = Buffer.from(`${ts}|${lastId}`, 'utf8').toString('base64');
        }
      }

      return { items, nextCursor };
    });
  }

  // ── findByIdForDetail ─────────────────────────────────────────────────────

  async findByIdForDetail(
    id: string,
    tenant: TenantContext,
  ): Promise<ValeArchivoSnapshot | null> {
    return this.executor.execute(tenant, async ({ client }) => {
      const valeResult = await client.query<DetailValeRow>(
        `SELECT
           id, numero_vale, fecha_solicitud, fecha_recepcion,
           unidad_solicitante,
           solicitante_nombre, solicitante_cargo,
           autorizador_nombre, autorizador_cargo,
           estado, creado_por,
           busqueda_iniciada_por, busqueda_iniciada_at,
           entregado_por, entregado_at, receptor_entrega,
           created_at, updated_at
         FROM vale_archivo
         WHERE id = $1`,
        [id],
      );

      if (valeResult.rows.length === 0) return null;

      const itemsResult = await client.query<DetailItemRow>(
        `SELECT
           id, vale_id, expediente_numero, paciente_nombre, especialidad,
           estado_busqueda, ubicacion_encontrada, observaciones
         FROM vale_archivo_items
         WHERE vale_id = $1
         ORDER BY id ASC`,
        [id],
      );

      return detailRowsToSnapshot(valeResult.rows[0]!, itemsResult.rows);
    });
  }
}

// ── Row types ─────────────────────────────────────────────────────────────────

interface SummaryRow {
  id: string;
  numero_vale: string;
  fecha_solicitud: Date;
  unidad_solicitante: string;
  solicitante_nombre: string;
  estado: string;
  item_count: number;
}

interface DetailValeRow {
  id: string;
  numero_vale: string;
  fecha_solicitud: Date;
  fecha_recepcion: Date;
  unidad_solicitante: string;
  solicitante_nombre: string;
  solicitante_cargo: string;
  autorizador_nombre: string;
  autorizador_cargo: string;
  estado: string;
  creado_por: string;
  busqueda_iniciada_por: string | null;
  busqueda_iniciada_at: Date | null;
  entregado_por: string | null;
  entregado_at: Date | null;
  receptor_entrega: string | null;
  created_at: Date;
  updated_at: Date;
}

interface DetailItemRow {
  id: string;
  vale_id: string;
  expediente_numero: string;
  paciente_nombre: string;
  especialidad: string;
  estado_busqueda: string;
  ubicacion_encontrada: string | null;
  observaciones: string | null;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function detailRowsToSnapshot(
  vale: DetailValeRow,
  items: DetailItemRow[],
): ValeArchivoSnapshot {
  return {
    id:                 vale.id,
    numeroVale:         vale.numero_vale,
    fechaSolicitud:     vale.fecha_solicitud,
    fechaRecepcion:     vale.fecha_recepcion,
    unidadSolicitante:  vale.unidad_solicitante,
    solicitante: {
      nombre: vale.solicitante_nombre,
      cargo:  vale.solicitante_cargo,
    },
    autorizador: {
      nombre: vale.autorizador_nombre,
      cargo:  vale.autorizador_cargo,
    },
    estado:              vale.estado as ValeArchivoSnapshot['estado'],
    creadoPor:           vale.creado_por,
    busquedaIniciadaPor: vale.busqueda_iniciada_por,
    busquedaIniciadaAt:  vale.busqueda_iniciada_at,
    entregadoPor:        vale.entregado_por,
    entregadoAt:         vale.entregado_at,
    receptorEntrega:     vale.receptor_entrega,
    createdAt:           vale.created_at,
    updatedAt:           vale.updated_at,
    items: items.map((row) => ({
      id:                  row.id,
      valeId:              row.vale_id,
      expedienteNumero:    row.expediente_numero,
      pacienteNombre:      row.paciente_nombre,
      especialidad:        row.especialidad,
      estadoBusqueda:      row.estado_busqueda as 'PENDIENTE' | 'LOCALIZADO' | 'NO_LOCALIZADO',
      ubicacionEncontrada: row.ubicacion_encontrada,
      observaciones:       row.observaciones,
    })),
  };
}
