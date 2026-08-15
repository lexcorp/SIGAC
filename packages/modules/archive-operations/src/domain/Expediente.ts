export type EstadoOperativoExpediente =
  | 'DISPONIBLE'
  | 'PREPARACION'
  | 'TRASLADO'
  | 'CUSTODIA_EXTERNA'
  | 'PENDIENTE_REARCHIVO'
  | 'INCIDENCIA';

export interface ExpedienteSnapshot {
  id: string;
  expedienteNumero: string;
  pacienteRef?: string;
  pacienteNombre?: string;
  estadoOperativo: EstadoOperativoExpediente;
  ubicacionActualId?: string;
  custodioRef?: string;
  rowVersion: number;
}

export class Expediente {
  private constructor(private state: ExpedienteSnapshot) {}

  static rehydrate(snapshot: ExpedienteSnapshot): Expediente {
    return new Expediente({ ...snapshot });
  }

  snapshot(): Readonly<ExpedienteSnapshot> {
    return Object.freeze({ ...this.state });
  }
}
