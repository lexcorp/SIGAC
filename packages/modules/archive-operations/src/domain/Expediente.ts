import { DomainError } from '@sigac/domain-kernel';
import type {
  Custodia,
  EstadoOperativo,
  ExpedienteId,
  ExpedienteNumero,
  Ubicacion,
} from './value-objects/index.js';
import { parseEstadoOperativo } from './value-objects/index.js';

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

/** Aggregate root que representa la situación operativa actual de un expediente físico. */
export class Expediente {
  private constructor(private readonly state: ExpedienteSnapshot) {}

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
