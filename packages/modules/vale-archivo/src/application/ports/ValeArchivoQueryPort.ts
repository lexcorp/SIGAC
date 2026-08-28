/**
 * ValeArchivoQueryPort — port de lectura (read side).
 *
 * Fuente: design.md §8.1, REQ-VA-003, ADR-0034.
 *
 * Separado del repository de escritura para respetar CQRS ligero:
 * las queries de listado y detalle para vista no pasan por el Aggregate.
 *
 * Todos los métodos reciben TenantContext para mantener tenant isolation.
 */

import type { TenantContext } from '@sigac/tenant';
import type { EstadoVale } from '../../domain/value-objects/EstadoVale.js';
import type { ValeArchivoSnapshot } from '../../domain/aggregates/ValeArchivo.js';

// ── Read models ──────────────────────────────────────────────────────────────

/**
 * Resumen de un ValeArchivo para listados paginados.
 * Expone solo los campos necesarios para la vista de lista (REQ-VA-003).
 * Sin PII de paciente (INV-VA-004): solo conteo de ítems, no nombres.
 */
export interface ValeArchivoSummary {
  readonly id: string;
  readonly numeroVale: string;
  readonly fechaSolicitud: Date;
  readonly unidadSolicitante: string;
  readonly solicitanteNombre: string;
  readonly estado: EstadoVale;
  readonly itemCount: number;
}

export interface ValeArchivoPage {
  readonly items: readonly ValeArchivoSummary[];
  readonly nextCursor: string | null;
}

// ── Filtros de consulta ───────────────────────────────────────────────────────

/**
 * Filtros opcionales para la lista de vales (REQ-VA-003.3..5).
 * Todos son opcionales; sin filtros devuelve todos los vales del tenant.
 */
export interface ValeArchivoPageFilter {
  /** Filtrar por estado exacto del vale. */
  readonly estado?: EstadoVale;
  /** Filtrar por fecha de solicitud exacta (YYYY-MM-DD). */
  readonly fecha?: string;
  /** Filtrar por substring de unidadSolicitante (case-insensitive). */
  readonly unidad?: string;
  /** Cursor opaco para paginación; undefined = primera página. */
  readonly cursor?: string;
  /** Máximo registros por página (default 20, máx 100). */
  readonly limit?: number;
}

// ── Port ──────────────────────────────────────────────────────────────────────

export interface ValeArchivoQueryPort {
  /**
   * Lista vales con paginación cursor-based (REQ-VA-003).
   * Retorna items del tenant activo aplicando filtros opcionales.
   */
  findPage(
    filter: ValeArchivoPageFilter,
    tenant: TenantContext,
  ): Promise<ValeArchivoPage>;

  /**
   * Recupera el snapshot completo de un vale para detalle y PDF.
   * Retorna null si no existe para el tenant activo.
   */
  findByIdForDetail(
    id: string,
    tenant: TenantContext,
  ): Promise<ValeArchivoSnapshot | null>;
}
