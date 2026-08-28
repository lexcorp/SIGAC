/**
 * IniciarBusqueda — use case VA-004 (transición RECIBIDA → EN_BUSQUEDA)
 *
 * Orquesta: validar permiso → cargar Aggregate → ejecutar comando → persistir → auditar.
 *
 * Fuente: design.md §8.2, REQ-VA-004, INV-VA-006, ADR-0033.
 *
 * Todas las reglas de transición viven en ValeArchivo.iniciarBusqueda().
 * El use case no duplica esa lógica.
 */

import type { AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import { ValeArchivo } from '../../domain/aggregates/ValeArchivo.js';
import type { ValeArchivoRepository } from '../ports/ValeArchivoRepository.js';
import { ApplicationError } from '../ApplicationError.js';

// ── Command ───────────────────────────────────────────────────────────────────

export interface IniciarBusquedaCommand {
  readonly valeId: string;
  readonly context: RequestContext;
}

// ── Dependencies ──────────────────────────────────────────────────────────────

export interface IniciarBusquedaDeps {
  readonly repository: ValeArchivoRepository;
  readonly auditWriter: AuditWriter;
}

// ── Use Case ─────────────────────────────────────────────────────────────────

export class IniciarBusqueda {
  constructor(private readonly deps: IniciarBusquedaDeps) {}

  async execute(command: IniciarBusquedaCommand): Promise<void> {
    const { valeId, context } = command;

    // ── 1. Verificar permiso (ADR-0033) ────────────────────────────────────
    if (!context.actor.permissions.has('ARCHIVE_REQUEST_PROCESS')) {
      await this.audit(valeId, 'denied', context);
      throw new ApplicationError(
        'PERMISSION_DENIED',
        'El actor no tiene el permiso ARCHIVE_REQUEST_PROCESS.',
      );
    }

    // ── 2. Cargar Aggregate (ADR-0034: tenant desde context) ───────────────
    const snapshot = await this.deps.repository.findById(valeId, context.tenant);
    if (snapshot === null) {
      await this.audit(valeId, 'not-found', context);
      throw new ApplicationError(
        'VALE_ARCHIVO_NOT_FOUND',
        `ValeArchivo con id "${valeId}" no encontrado.`,
      );
    }

    const vale = ValeArchivo.reconstitute(snapshot);

    // ── 3. Ejecutar comando del domain — transición RECIBIDA → EN_BUSQUEDA ─
    // InvalidStateTransitionError se propaga hacia arriba (el controller la mapea a 422)
    const now = new Date();
    vale.iniciarBusqueda(context.actor.actorId, now);

    // ── 4. Persistir ───────────────────────────────────────────────────────
    await this.deps.repository.save(vale, context.tenant);

    // ── 5. Audit (INV-VA-006) ──────────────────────────────────────────────
    await this.audit(valeId, 'success', context);
  }

  private audit(
    resourceId: string,
    result: 'success' | 'denied' | 'not-found',
    context: RequestContext,
  ): Promise<void> {
    return this.deps.auditWriter.append(
      {
        action: 'VALE_BUSQUEDA_INICIADA',
        resourceType: 'VALE_ARCHIVO',
        resourceId,
        result,
      },
      context,
    );
  }
}
