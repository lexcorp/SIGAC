/**
 * PostgresValeArchivoRepository
 *
 * Adapter de escritura para ValeArchivo — implementa ValeArchivoRepository.
 *
 * Fuente: design.md §10.1, ADR-0034 (sin tenant_id en tablas).
 *
 * Patrón: igual que PostgresImportacionAgendaRepository.
 *   - TenantSessionExecutor enruta la conexión al database del tenant.
 *   - Upsert atómico: INSERT para creates, UPDATE para re-saves.
 *   - Items: DELETE + INSERT (vale tiene un número pequeño de ítems; es simple y seguro).
 *   - No contiene lógica de negocio.
 */

import type { ValeArchivo, ValeArchivoSnapshot } from '@sigac/vale-archivo';
import type { ValeArchivoRepository } from '@sigac/vale-archivo';
import type { TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter } from '../TenantDatabaseRouter.js';
import { TenantSessionExecutor } from '../internal/TenantSessionExecutor.js';

export class PostgresValeArchivoRepository implements ValeArchivoRepository {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter) {
    this.executor = new TenantSessionExecutor(router);
  }

  // ── save ──────────────────────────────────────────────────────────────────

  async save(vale: ValeArchivo, tenant: TenantContext): Promise<void> {
    const s = vale.snapshot();
    await this.executor.execute(tenant, async ({ client }) => {
      // Upsert vale_archivo
      await client.query(
        `INSERT INTO vale_archivo (
           id, numero_vale, fecha_solicitud, fecha_recepcion,
           unidad_solicitante,
           solicitante_nombre, solicitante_cargo,
           autorizador_nombre, autorizador_cargo,
           estado, creado_por,
           busqueda_iniciada_por, busqueda_iniciada_at,
           entregado_por, entregado_at, receptor_entrega,
           created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
         )
         ON CONFLICT (id) DO UPDATE SET
           estado                = EXCLUDED.estado,
           busqueda_iniciada_por = EXCLUDED.busqueda_iniciada_por,
           busqueda_iniciada_at  = EXCLUDED.busqueda_iniciada_at,
           entregado_por         = EXCLUDED.entregado_por,
           entregado_at          = EXCLUDED.entregado_at,
           receptor_entrega      = EXCLUDED.receptor_entrega,
           updated_at            = EXCLUDED.updated_at`,
        [
          s.id,
          s.numeroVale,
          s.fechaSolicitud,
          s.fechaRecepcion,
          s.unidadSolicitante,
          s.solicitante.nombre,
          s.solicitante.cargo,
          s.autorizador.nombre,
          s.autorizador.cargo,
          s.estado,
          s.creadoPor,
          s.busquedaIniciadaPor,
          s.busquedaIniciadaAt,
          s.entregadoPor,
          s.entregadoAt,
          s.receptorEntrega,
          s.createdAt,
          s.updatedAt,
        ],
      );

      // Reemplazar ítems: delete + insert (los ítems solo cambian su estado_busqueda;
      // nunca se eliminan ni se agregan en v0.1 tras la creación)
      await client.query(
        `DELETE FROM vale_archivo_items WHERE vale_id = $1`,
        [s.id],
      );

      for (const item of s.items) {
        await client.query(
          `INSERT INTO vale_archivo_items (
             id, vale_id,
             expediente_numero, paciente_nombre, especialidad,
             estado_busqueda, ubicacion_encontrada, observaciones
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            item.id,
            item.valeId,
            item.expedienteNumero,
            item.pacienteNombre,
            item.especialidad,
            item.estadoBusqueda,
            item.ubicacionEncontrada,
            item.observaciones,
          ],
        );
      }
    }).catch((err: unknown) => {
      // Handle unique constraint violation (concurrent duplicate — second line of defense).
      // The unique constraint is 'vale_archivo_numero_vale_unique'.
      if (
        err instanceof Error &&
        err.message.includes('vale_archivo_numero_vale_unique')
      ) {
        // Import ApplicationError lazily to avoid circular dep with @sigac/database.
        // Re-throw as a plain Error with a recognizable code so the use case / controller
        // can map it to VALE_NUMERO_DUPLICADO without coupling the DB layer to the app layer.
        const e = new Error('VALE_NUMERO_DUPLICADO');
        e.name = 'ValeNumeroDuplicadoError';
        throw e;
      }
      throw err;
    });
  }

  // ── existsByNumeroVale ────────────────────────────────────────────────────

  async existsByNumeroVale(numeroVale: string, tenant: TenantContext): Promise<boolean> {
    return this.executor.execute(tenant, async ({ client }) => {
      const result = await client.query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM vale_archivo WHERE numero_vale = $1) AS exists`,
        [numeroVale],
      );
      return result.rows[0]!.exists;
    });
  }

  // ── findById ──────────────────────────────────────────────────────────────

  async findById(id: string, tenant: TenantContext): Promise<ValeArchivoSnapshot | null> {
    return this.executor.execute(tenant, async ({ client }) => {
      const valeResult = await client.query<ValeRow>(
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

      const itemsResult = await client.query<ItemRow>(
        `SELECT
           id, vale_id, expediente_numero, paciente_nombre, especialidad,
           estado_busqueda, ubicacion_encontrada, observaciones
         FROM vale_archivo_items
         WHERE vale_id = $1
         ORDER BY id ASC`,
        [id],
      );

      return rowsToSnapshot(valeResult.rows[0]!, itemsResult.rows);
    });
  }
}

// ── Row types ─────────────────────────────────────────────────────────────────

interface ValeRow {
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

interface ItemRow {
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

function rowsToSnapshot(vale: ValeRow, items: ItemRow[]): ValeArchivoSnapshot {
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
