/**
 * CerrarValeAdministrativo — use case VA-007
 * REQUEST_CREATE | REQUEST_ASSIGN → NO_LOCALIZADA → CERRADA
 */
import type { AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import { ValeArchivo } from '../../domain/aggregates/ValeArchivo.js';
import type { ValeArchivoRepository } from '../ports/ValeArchivoRepository.js';
import { ApplicationError } from '../ApplicationError.js';

export interface CerrarValeAdministrativoCommand {
  readonly valeId: string;
  readonly motivo?: string;
  readonly context: RequestContext;
}

export interface CerrarValeAdministrativoDeps {
  readonly repository: ValeArchivoRepository;
  readonly auditWriter: AuditWriter;
}

export class CerrarValeAdministrativo {
  constructor(private readonly deps: CerrarValeAdministrativoDeps) {}

  async execute(cmd: CerrarValeAdministrativoCommand): Promise<void> {
    const { valeId, context } = cmd;

    if (
      !context.actor.permissions.has('REQUEST_CREATE') &&
      !context.actor.permissions.has('REQUEST_ASSIGN')
    ) {
      await this.audit(valeId, 'denied', context);
      throw new ApplicationError('PERMISSION_DENIED', 'REQUEST_CREATE o REQUEST_ASSIGN requerido.');
    }

    const snapshot = await this.deps.repository.findById(valeId, context.tenant);
    if (snapshot === null) {
      await this.audit(valeId, 'not-found', context);
      throw new ApplicationError('VALE_ARCHIVO_NOT_FOUND', `Vale "${valeId}" no encontrado.`);
    }

    const vale = ValeArchivo.reconstitute(snapshot);
    vale.cerrarAdministrativamente(context.actor.actorId, cmd.motivo ?? null, new Date());
    await this.deps.repository.save(vale, context.tenant);
    await this.audit(valeId, 'success', context);
  }

  private audit(
    resourceId: string,
    result: 'success' | 'denied' | 'not-found',
    context: RequestContext,
  ): Promise<void> {
    return this.deps.auditWriter.append(
      { action: 'VALE_CERRADO_ADMINISTRATIVO', resourceType: 'VALE_ARCHIVO', resourceId, result },
      context,
    );
  }
}
