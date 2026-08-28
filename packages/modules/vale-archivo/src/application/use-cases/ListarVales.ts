/**
 * ListarVales — use case VA-004 (lista paginada)
 *
 * Orquesta: validar permiso → consultar página desde queryPort → retornar.
 *
 * Fuente: design.md §8.2, REQ-VA-003.1..7, ADR-0033, ADR-0034.
 *
 * Paginación cursor-based igual al patrón establecido en SIGAC
 * (ListAgendaImports, GetAgendaPreparationList).
 */

import type { AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { EstadoVale } from '../../domain/value-objects/EstadoVale.js';
import type {
  ValeArchivoPage,
  ValeArchivoQueryPort,
} from '../ports/ValeArchivoQueryPort.js';
import { ApplicationError } from '../ApplicationError.js';

// ── Query ─────────────────────────────────────────────────────────────────────

export interface ListarValesQuery {
  readonly estado?: EstadoVale;
  readonly fecha?: string;        // YYYY-MM-DD
  readonly unidad?: string;       // substring case-insensitive
  readonly cursor?: string;
  readonly limit?: number;        // default 20, máx 100
  readonly context: RequestContext;
}

// ── Dependencies ──────────────────────────────────────────────────────────────

export interface ListarValesDeps {
  readonly queryPort: ValeArchivoQueryPort;
  readonly auditWriter: AuditWriter;
}

// ── Use Case ─────────────────────────────────────────────────────────────────

export class ListarVales {
  constructor(private readonly deps: ListarValesDeps) {}

  async execute(query: ListarValesQuery): Promise<ValeArchivoPage> {
    const { context } = query;

    // ── 1. Verificar permiso (ADR-0033) ────────────────────────────────────
    if (!context.actor.permissions.has('ARCHIVE_REQUEST_VIEW')) {
      await this.audit('denied', context);
      throw new ApplicationError(
        'PERMISSION_DENIED',
        'El actor no tiene el permiso ARCHIVE_REQUEST_VIEW.',
      );
    }

    // ── 2. Construir filtro y consultar (ADR-0034: tenant isolation) ───────
    const effectiveLimit = Math.min(query.limit ?? 20, 100);

    const page = await this.deps.queryPort.findPage(
      {
        estado: query.estado,
        fecha: query.fecha,
        unidad: query.unidad,
        cursor: query.cursor,
        limit: effectiveLimit,
      },
      context.tenant,
    );

    await this.audit('success', context);
    return page;
  }

  private audit(
    result: 'success' | 'denied',
    context: RequestContext,
  ): Promise<void> {
    return this.deps.auditWriter.append(
      {
        action: 'VALE_ARCHIVO_LIST',
        resourceType: 'VALE_ARCHIVO',
        resourceId: 'LIST',
        result,
      },
      context,
    );
  }
}
