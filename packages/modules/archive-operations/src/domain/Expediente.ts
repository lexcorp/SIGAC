import { DomainError, type DomainEvent } from '@sigac/domain-kernel';
import type {
  Custodia,
  EstadoOperativo,
  ExpedienteId,
  ExpedienteNumero,
  Ubicacion,
} from './value-objects/index.js';
import { Custodia as CustodiaValue, parseEstadoOperativo } from './value-objects/index.js';

/** Referencia operativa mínima aprobada; no contiene información clínica. */
export interface PacienteReferencia {
  readonly idInstitucional: string;
  readonly curp: string;
  readonly nombreOperativo: string;
  readonly numeroIssste: string;
}

/** Identificador del hospital al que pertenece el Expediente. */
export type HospitalId = string;

export interface ExpedienteSnapshot {
  readonly id: ExpedienteId;
  readonly expedienteNumero: ExpedienteNumero;
  readonly pacienteReferencia: Readonly<PacienteReferencia>;
  readonly hospitalId: HospitalId;
  readonly estadoOperativo: EstadoOperativo;
  readonly ubicacionActual: Ubicacion | null;
  readonly custodiaActual: Custodia | null;
  readonly rowVersion: bigint;
}

export interface IntendedCustodian {
  readonly type: string;
  readonly reference: string;
}

export interface BusinessReference {
  readonly type: string;
  readonly id: string | null;
}

export interface ExpedienteDispatchedPayload {
  readonly expedienteId: ExpedienteId;
  readonly originLocation: Ubicacion | null;
  readonly destinationLocation: Ubicacion;
  readonly originCustodianRef: string | null;
  readonly intendedCustodian: IntendedCustodian;
  readonly businessReferenceType: string;
  readonly businessReferenceId: string | null;
}

export type ExpedienteDispatched = DomainEvent<ExpedienteDispatchedPayload> & {
  readonly name: 'ExpedienteDispatched';
};

export interface DispatchExpedienteTransitionInput {
  readonly destination: Ubicacion;
  readonly intendedCustodian: IntendedCustodian;
  readonly businessReference: BusinessReference;
  readonly occurredAt: Date;
}

/** Aggregate root que representa la situación operativa actual de un expediente físico. */
export class Expediente {
  private constructor(private state: ExpedienteSnapshot) {}

  /** Rehidrata el aggregate aplicando las invariantes vigentes. */
  static rehydrate(snapshot: ExpedienteSnapshot): Expediente {
    const estadoOperativo = parseEstadoOperativo(snapshot.estadoOperativo);
    Expediente.assertSituacionOperativaCoherente(estadoOperativo, snapshot.custodiaActual);
    Object.freeze(snapshot.id);
    Object.freeze(snapshot.expedienteNumero);
    if (snapshot.ubicacionActual) Object.freeze(snapshot.ubicacionActual);
    if (snapshot.custodiaActual) Object.freeze(snapshot.custodiaActual);

    return new Expediente({
      id: snapshot.id,
      expedienteNumero: snapshot.expedienteNumero,
      pacienteReferencia: Object.freeze({ ...snapshot.pacienteReferencia }),
      hospitalId: snapshot.hospitalId,
      estadoOperativo,
      ubicacionActual: snapshot.ubicacionActual,
      custodiaActual: snapshot.custodiaActual,
      rowVersion: snapshot.rowVersion,
    });
  }

  snapshot(): Readonly<ExpedienteSnapshot> {
    return Object.freeze({
      ...this.state,
      pacienteReferencia: Object.freeze({ ...this.state.pacienteReferencia }),
    });
  }

  dispatch(input: DispatchExpedienteTransitionInput): ExpedienteDispatched {
    if (this.state.estadoOperativo !== 'APARTADO') {
      throw new DomainError(
        'EXPEDIENTE_DISPATCH_ESTADO_INVALIDO',
        'DispatchExpediente requiere un Expediente en estado APARTADO.',
      );
    }

    Expediente.assertRequiredText(input.intendedCustodian.type, 'type');
    Expediente.assertRequiredText(input.intendedCustodian.reference, 'reference');

    const originLocation = this.state.ubicacionActual;
    const originCustodianRef = this.state.custodiaActual?.custodianReference ?? null;
    const custodiaActual = CustodiaValue.enTraslado({
      custodianType: input.intendedCustodian.type,
      custodianReference: input.intendedCustodian.reference,
    });

    this.state = {
      ...this.state,
      estadoOperativo: 'EN_TRASLADO',
      ubicacionActual: input.destination,
      custodiaActual,
      rowVersion: this.state.rowVersion + 1n,
    };

    return {
      name: 'ExpedienteDispatched',
      occurredAt: input.occurredAt,
      payload: {
        expedienteId: this.state.id,
        originLocation,
        destinationLocation: input.destination,
        originCustodianRef,
        intendedCustodian: Object.freeze({ ...input.intendedCustodian }),
        businessReferenceType: input.businessReference.type,
        businessReferenceId: input.businessReference.id,
      },
    };
  }

  private static assertRequiredText(value: string, field: string): void {
    if (value.trim().length === 0) {
      throw new DomainError(
        'CUSTODIO_PREVISTO_INVALIDO',
        `intendedCustodian.${field} es obligatorio y no puede estar vacío.`,
      );
    }
  }

  private static assertSituacionOperativaCoherente(
    estadoOperativo: EstadoOperativo,
    custodiaActual: Custodia | null,
  ): void {
    if (
      estadoOperativo === 'EN_TRASLADO' &&
      (custodiaActual === null || custodiaActual.estaAceptada)
    ) {
      throw new DomainError(
        'SITUACION_OPERATIVA_INCOHERENTE',
        'EN_TRASLADO requiere una Custodia actual todavía no aceptada.',
      );
    }

    if (
      estadoOperativo === 'EN_CONSULTA' &&
      (custodiaActual === null || !custodiaActual.estaAceptada)
    ) {
      throw new DomainError(
        'SITUACION_OPERATIVA_INCOHERENTE',
        'EN_CONSULTA requiere una Custodia actual aceptada.',
      );
    }
  }
}
