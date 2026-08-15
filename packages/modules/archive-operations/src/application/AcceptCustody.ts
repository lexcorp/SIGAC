import { DomainError } from '@sigac/domain-kernel';
import type { RequestContext } from '@sigac/tenant';
import type {
  AcceptedCustodian,
  BusinessReference,
  CustodyAccepted,
} from '../domain/Expediente.js';
import type { ExpedienteId, Ubicacion } from '../domain/value-objects/index.js';
import type { ArchiveOperationsUnitOfWork } from './ArchiveOperationsUnitOfWork.js';
import { ApplicationError } from './ApplicationError.js';
import type { AuditResult, AuditWriter } from './AuditWriter.js';

export interface AcceptCustodyInput {
  readonly expedienteId: ExpedienteId;
  readonly receptor: AcceptedCustodian;
  readonly ubicacionDestino: Ubicacion;
  readonly businessReference: BusinessReference;
  readonly expectedRowVersion: bigint;
  readonly context: RequestContext;
}

export interface AcceptCustodyDependencies {
  readonly unitOfWork: ArchiveOperationsUnitOfWork;
  readonly auditWriter: AuditWriter;
}

export class AcceptCustody {
  constructor(private readonly dependencies: AcceptCustodyDependencies) {}

  async execute(input: AcceptCustodyInput): Promise<CustodyAccepted> {
    if (!input.context.actor.permissions.has('CUSTODY_ACCEPT')) {
      await this.audit(input, 'denied');
      throw new ApplicationError(
        'PERMISSION_DENIED',
        'El actor no tiene permiso para aceptar la custodia del Expediente.',
      );
    }

    try {
      return await this.dependencies.unitOfWork.execute(input.context, async (transaction) => {
        const expediente = await transaction.expedienteRepository.findById(
          input.expedienteId,
          input.context.tenant,
        );
        if (expediente === null) {
          throw new ApplicationError(
            'EXPEDIENTE_NOT_FOUND',
            'El Expediente no existe en el tenant activo.',
          );
        }

        if (expediente.snapshot().rowVersion !== input.expectedRowVersion) {
          throw new ApplicationError(
            'OPTIMISTIC_LOCK_CONFLICT',
            'La versión del Expediente cambió antes de aceptar la custodia.',
          );
        }

        const before = expediente.snapshot();
        let event: CustodyAccepted;
        try {
          event = expediente.acceptCustody({
            receptor: input.receptor,
            ubicacionDestino: input.ubicacionDestino,
            occurredAt: transaction.operationOccurredAt,
          });
        } catch (error) {
          if (
            error instanceof DomainError &&
            error.code === 'EXPEDIENTE_ACCEPT_CUSTODY_ESTADO_INVALIDO'
          ) {
            throw new ApplicationError(
              'REQUEST_INVALID_TRANSITION',
              'El Expediente no permite aceptar custodia en su estado o ubicación actual.',
            );
          }
          throw error;
        }

        await transaction.expedienteRepository.save(expediente, input.context.tenant);
        await transaction.movimientoWriter.append(
          {
            expedienteId: input.expedienteId,
            movementType: 'CUSTODY_ACCEPTED',
            originLocation: before.ubicacionActual?.id ?? null,
            destinationLocation: input.ubicacionDestino.id,
            originCustodianRef: before.custodiaActual?.custodianReference ?? null,
            destinationCustodianRef: input.receptor.reference,
            businessReferenceType: input.businessReference.type,
            businessReferenceId: input.businessReference.id,
            occurredAt: transaction.operationOccurredAt,
            actorRef: input.context.actor.actorId,
            source: input.context.source,
            correlationId: input.context.correlationId,
          },
          input.context.tenant,
        );
        await transaction.auditWriter.append(this.auditEntry(input, 'success'), input.context);
        return event;
      });
    } catch (error) {
      if (!(error instanceof ApplicationError)) throw error;
      const result = this.auditResultFor(error);
      if (result !== null) await this.audit(input, result);
      throw error;
    }
  }

  private auditResultFor(error: ApplicationError): AuditResult | null {
    switch (error.code) {
      case 'EXPEDIENTE_NOT_FOUND':
        return 'not-found';
      case 'OPTIMISTIC_LOCK_CONFLICT':
        return 'conflict';
      case 'REQUEST_INVALID_TRANSITION':
        return 'invalid-transition';
      default:
        return null;
    }
  }

  private audit(input: AcceptCustodyInput, result: AuditResult): Promise<void> {
    return this.dependencies.auditWriter.append(this.auditEntry(input, result), input.context);
  }

  private auditEntry(input: AcceptCustodyInput, result: AuditResult) {
    return {
      action: 'CUSTODY_ACCEPTED',
      resourceType: 'EXPEDIENTE',
      resourceId: input.expedienteId.toString(),
      result,
    } as const;
  }
}
