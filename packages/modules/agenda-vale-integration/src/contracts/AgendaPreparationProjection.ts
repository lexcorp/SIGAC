import type { AgendaAgendaItem } from './AgendaAgendaItem.js';

/** Snapshot neutral e inmutable entregado por el ACL source. */
export interface AgendaPreparationProjection {
  readonly agendaDate: string;
  readonly sourceImportacionId: string;
  /** Token opaco: Application no interpreta su algoritmo ni encoding. */
  readonly sourceVersion: string;
  readonly items: readonly AgendaAgendaItem[];
}

export interface ValeHeaderInput {
  readonly fechaSolicitud: string;
  readonly fechaRecepcion: string;
  readonly unidadSolicitante: string;
  readonly solicitante: {
    readonly nombre: string;
    readonly cargo: string;
  };
  readonly autorizador: {
    readonly nombre: string;
    readonly cargo: string;
  };
}

export interface ValeGroupKey {
  readonly agendaDate: string;
  readonly servicioCodigo: string;
  readonly medicoNumeroEmpleado: string;
}
