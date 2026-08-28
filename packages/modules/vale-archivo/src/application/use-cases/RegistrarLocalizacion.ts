/**
 * RegistrarLocalizacion — use case VA-005
 * ARCHIVE_REQUEST_PROCESS → actualiza estadoBusqueda del ítem
 * → transición automática del vale si todos resueltos.
 */
import type { AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import { ValeArchivo } from '../../domain/aggregates/ValeArchivo.js';
import type { ValeArchivoRepository } from '../ports/ValeArchivoRepository.js';
import { ApplicationError } from '../ApplicationError.js';

export interface RegistrarLocalizacionCommand {
  readonly valeId: string;
  readonly itemId: string;
  readonly estadoBusqueda: 'LOCALIZADO' | 'NO_LOCALIZADO';
  readonly ubicacionEncontrada?: string;
  readonly observaciones?: string;
  readonly context: RequestContext;
}

export interface RegistrarLocalizacionDeps {
  readonly repository: ValeArchivoRepository;
  readonly auditWriter: AuditWriter;
}

export class RegistrarLocalizacion {
  constructor(private readonly deps: RegistrarLocalizacionDeps) {}

  async execute(cmd: RegistrarLocalizacionCommand): Promise<void> {
    const { valeId, context } = cmd;

    if (!context.actor.permissions.has('ARCHIVE_REQUEST_PROCESS')) {
      await this.audit(valeId, 'denied', context);
      throw new ApplicationError('PERMISSION_DENIED', 'ARCHIVE_REQUEST_PROCESS requerido.');
    }

    const snapshot = await this.deps.repository.findById(valeId, context.tenant);
    if (snapshot === null) {
      await this.audit(valeId, 'not-found', context);
      throw new ApplicationError('VALE_ARCHIVO_NOT_FOUND', `Vale "${valeId}" no encontrado.`);
    }

    const vale = ValeArchivo.reconstitute(snapshot);
    // Domain throws InvalidStateTransitionError / ValeArchivoItemNotFoundError
    vale.registrarLocalizacion(
      cmd.itemId,
      cmd.estadoBusqueda,
      cmd.ubicacionEncontrada ?? null,
      cmd.observaciones ?? null,
      new Date(),
    );
    await this.deps.repository.save(vale, context.tenant);

    if (vale.estado !== 'EN_BUSQUEDA') {
      // Transition occurred — log the new state
      await this.audit(valeId, 'success', context, { estadoNuevo: vale.estado });
    }
  }

  private audit(
    resourceId: string,
    result: 'success' | 'denied' | 'not-found',
    context: RequestContext,
    changeSummary?: Record<string, string>,
  ): Promise<void> {
    return this.deps.auditWriter.append(
      { action: 'VALE_ESTADO_ACTUALIZADO', resourceType: 'VALE_ARCHIVO', resourceId, result, changeSummary },
      context,
    );
  }
}
