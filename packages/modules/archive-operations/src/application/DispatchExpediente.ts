import { DomainError } from '@sigac/domain-kernel';
import type { RequestContext } from '@sigac/tenant';
import type {
  BusinessReference,
  ExpedienteDispatched,
  IntendedCustodian,
} from '../domain/Expediente.js';
import type { ExpedienteId, Ubicacion } from '../domain/value-objects/index.js';
import type { ArchiveOperationsUnitOfWork } from './ArchiveOperationsUnitOfWork.js';
import { ApplicationError } from './ApplicationError.js';
import type { AuditResult, AuditWriter } from '@sigac/audit';

export interface DispatchExpedienteInput {
  readonly expedienteId: ExpedienteId;
  readonly destination: Ubicacion;
  readonly intendedCustodian: IntendedCustodian;
  readonly businessReference: BusinessReference;
  readonly expectedRowVersion: bigint;
  readonly context: RequestContext;
}

export interface DispatchExpedienteDependencies {
  readonly unitOfWork: ArchiveOperationsUnitOfWork;
  /** Writer externo a la UoW mutante para intentos fallidos. */
  readonly auditWriter: AuditWriter;
}

export class DispatchExpediente {
  constructor(private readonly dependencies: DispatchExpedienteDependencies) {}

  async execute(input: DispatchExpedienteInput): Promise<ExpedienteDispatched> {
    if (!input.context.actor.permissions.has('EXPEDIENT_DISPATCH')) {
      await this.audit(input, 'denied');
      throw new ApplicationError(
        'PERMISSION_DENIED',
        'El actor no tiene permiso para despachar el Expediente.',
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
            'La versión del Expediente cambió antes del despacho.',
          );
        }

        let event: ExpedienteDispatched;
        try {
          event = expediente.dispatch({
            destination: input.destination,
            intendedCustodian: input.intendedCustodian,
            businessReference: input.businessReference,
            occurredAt: transaction.operationOccurredAt,
          });
        } catch (error) {
          if (
            error instanceof DomainError &&
            error.code === 'EXPEDIENTE_DISPATCH_ESTADO_INVALIDO'
          ) {
            throw new ApplicationError(
              'REQUEST_INVALID_TRANSITION',
              'El Expediente no se puede despachar desde su estado actual.',
            );
          }
          throw error;
        }

        await transaction.expedienteRepository.save(expediente, input.context.tenant);
        await transaction.movimientoWriter.append(
          {
            expedienteId: input.expedienteId,
            movementType: 'DISPATCHED',
            originLocation: event.payload.originLocation?.id ?? null,
            destinationLocation: event.payload.destinationLocation.id,
            originCustodianRef: event.payload.originCustodianRef,
            destinationCustodianRef: event.payload.intendedCustodian.reference,
            businessReferenceType: event.payload.businessReferenceType,
            businessReferenceId: event.payload.businessReferenceId,
            occurredAt: transaction.operationOccurredAt,
            actorRef: input.context.actor.actorId,
            source: input.context.source,
            correlationId: input.context.correlationId,
          },
          input.context.tenant,
        );
        await transaction.auditWriter.append(
          this.auditEntry(input, 'success'),
          input.context,
        );

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

  private audit(input: DispatchExpedienteInput, result: AuditResult): Promise<void> {
    return this.dependencies.auditWriter.append(this.auditEntry(input, result), input.context);
  }

  private auditEntry(input: DispatchExpedienteInput, result: AuditResult) {
    return {
      action: 'EXPEDIENTE_DISPATCH',
      resourceType: 'EXPEDIENTE',
      resourceId: input.expedienteId.toString(),
      result,
    } as const;
  }
}
