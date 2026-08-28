/**
 * RegistrarEntrega — use case VA-006
 * ARCHIVE_REQUEST_DELIVER → COMPLETA|PARCIAL → ENTREGADA
 */
import type { AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import { ValeArchivo } from '../../domain/aggregates/ValeArchivo.js';
import type { ValeArchivoRepository } from '../ports/ValeArchivoRepository.js';
import { ApplicationError } from '../ApplicationError.js';

export interface RegistrarEntregaCommand {
  readonly valeId: string;
  readonly receptorEntrega: string;
  readonly entregadoAt: string;        // ISO 8601
  readonly itemsEntregados: readonly string[];
  readonly context: RequestContext;
}

export interface RegistrarEntregaDeps {
  readonly repository: ValeArchivoRepository;
  readonly auditWriter: AuditWriter;
}

export class RegistrarEntrega {
  constructor(private readonly deps: RegistrarEntregaDeps) {}

  async execute(cmd: RegistrarEntregaCommand): Promise<void> {
    const { valeId, context } = cmd;

    if (!context.actor.permissions.has('ARCHIVE_REQUEST_DELIVER')) {
      await this.audit(valeId, 'denied', context);
      throw new ApplicationError('PERMISSION_DENIED', 'ARCHIVE_REQUEST_DELIVER requerido.');
    }

    const snapshot = await this.deps.repository.findById(valeId, context.tenant);
    if (snapshot === null) {
      await this.audit(valeId, 'not-found', context);
      throw new ApplicationError('VALE_ARCHIVO_NOT_FOUND', `Vale "${valeId}" no encontrado.`);
    }

    const vale = ValeArchivo.reconstitute(snapshot);
    vale.registrarEntrega(
      context.actor.actorId,
      cmd.receptorEntrega,
      cmd.itemsEntregados,
      new Date(cmd.entregadoAt),
    );
    await this.deps.repository.save(vale, context.tenant);
    await this.audit(valeId, 'success', context, {
      itemCount: String(cmd.itemsEntregados.length),
      entregadoAt: cmd.entregadoAt,
    });
  }

  private audit(
    resourceId: string,
    result: 'success' | 'denied' | 'not-found',
    context: RequestContext,
    changeSummary?: Record<string, string>,
  ): Promise<void> {
    return this.deps.auditWriter.append(
      { action: 'VALE_ENTREGADO', resourceType: 'VALE_ARCHIVO', resourceId, result, changeSummary },
      context,
    );
  }
}
