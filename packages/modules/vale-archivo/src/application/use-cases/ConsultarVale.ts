/**
 * ConsultarVale — use case VA-003 (detalle de un vale)
 *
 * Orquesta: validar permiso → leer snapshot desde queryPort → retornar.
 *
 * Fuente: design.md §8.2, REQ-VA-003 (detalle), ADR-0033, ADR-0034.
 *
 * No modifica el Aggregate; usa el QueryPort de lectura directamente.
 */

import type { AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { ValeArchivoSnapshot } from '../../domain/aggregates/ValeArchivo.js';
import type { ValeArchivoQueryPort } from '../ports/ValeArchivoQueryPort.js';
import { ApplicationError } from '../ApplicationError.js';

// ── Query ─────────────────────────────────────────────────────────────────────

export interface ConsultarValeQuery {
  readonly valeId: string;
  readonly context: RequestContext;
}

// ── Dependencies ──────────────────────────────────────────────────────────────

export interface ConsultarValeDeps {
  readonly queryPort: ValeArchivoQueryPort;
  readonly auditWriter: AuditWriter;
}

// ── Use Case ─────────────────────────────────────────────────────────────────

export class ConsultarVale {
  constructor(private readonly deps: ConsultarValeDeps) {}

  async execute(query: ConsultarValeQuery): Promise<ValeArchivoSnapshot> {
    const { valeId, context } = query;

    // ── 1. Verificar permiso (ADR-0033) ────────────────────────────────────
    if (
      !context.actor.permissions.has('ARCHIVE_REQUEST_VIEW') &&
      !context.actor.permissions.has('REQUEST_CREATE')
    ) {
      await this.audit(valeId, 'denied', context);
      throw new ApplicationError(
        'PERMISSION_DENIED',
        'El actor no tiene ARCHIVE_REQUEST_VIEW ni REQUEST_CREATE.',
      );
    }

    // ── 2. Obtener detalle del vale (ADR-0034: tenant desde context) ───────
    const snapshot = await this.deps.queryPort.findByIdForDetail(
      valeId,
      context.tenant,
    );

    if (snapshot === null) {
      await this.audit(valeId, 'not-found', context);
      throw new ApplicationError(
        'VALE_ARCHIVO_NOT_FOUND',
        `ValeArchivo con id "${valeId}" no encontrado.`,
      );
    }

    await this.audit(valeId, 'success', context);
    return snapshot;
  }

  private audit(
    resourceId: string,
    result: 'success' | 'denied' | 'not-found',
    context: RequestContext,
  ): Promise<void> {
    return this.deps.auditWriter.append(
      {
        action: 'VALE_ARCHIVO_VIEW',
        resourceType: 'VALE_ARCHIVO',
        resourceId,
        result,
      },
      context,
    );
  }
}
