/**
 * Tipos del bounded context Vale Archivo — frontend.
 *
 * Derivados de los contratos OpenAPI en openapi/sigac-v1.yaml.
 * No duplican reglas de negocio: los estados y transiciones son validados
 * exclusivamente por el backend.
 */

// ── Estados ────────────────────────────────────────────────────────────────

export type EstadoVale =
  | 'RECIBIDA'
  | 'EN_BUSQUEDA'
  | 'COMPLETA'
  | 'PARCIAL'
  | 'NO_LOCALIZADA'
  | 'ENTREGADA'
  | 'CERRADA';

export type EstadoBusqueda = 'PENDIENTE' | 'LOCALIZADO' | 'NO_LOCALIZADO';

// ── Read models ────────────────────────────────────────────────────────────

export interface SolicitanteReferencia {
  readonly nombre: string;
  readonly cargo: string;
}

export interface ValeArchivoSummary {
  readonly id: string;
  readonly numeroVale: string;
  readonly fechaSolicitud: string;      // ISO date
  readonly unidadSolicitante: string;
  readonly solicitanteNombre: string;
  readonly estado: EstadoVale;
  readonly itemCount: number;
}

export interface ValeArchivoPage {
  readonly items: readonly ValeArchivoSummary[];
  readonly nextCursor: string | null;
}

export interface ValeArchivoItemDetail {
  readonly id: string;
  readonly expedienteNumero: string;
  readonly pacienteNombre: string;
  readonly especialidad: string;
  readonly estadoBusqueda: EstadoBusqueda;
  readonly ubicacionEncontrada: string | null;
  readonly observaciones: string | null;
}

export interface ValeArchivoDetail {
  readonly id: string;
  readonly numeroVale: string;
  readonly fechaSolicitud: string;
  readonly fechaRecepcion: string;
  readonly unidadSolicitante: string;
  readonly solicitante: SolicitanteReferencia;
  readonly autorizador: SolicitanteReferencia;
  readonly estado: EstadoVale;
  readonly creadoPor: string;
  readonly busquedaIniciadaPor: string | null;
  readonly busquedaIniciadaAt: string | null;
  readonly entregadoPor: string | null;
  readonly entregadoAt: string | null;
  readonly receptorEntrega: string | null;
  readonly createdAt: string;
  readonly actualizadoEn: string;
  readonly items: readonly ValeArchivoItemDetail[];
}

// ── Error RFC7807 ──────────────────────────────────────────────────────────

export interface ValeArchivoProblem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly errors?: readonly { field: string; code: string }[];
}

// ── Request payloads ───────────────────────────────────────────────────────

export interface CreateValeItemInput {
  expedienteNumero: string;
  pacienteNombre: string;
  especialidad: string;
}

export interface CreateValeInput {
  numeroVale: string;
  fechaSolicitud: string;
  fechaRecepcion: string;
  unidadSolicitante: string;
  solicitanteNombre: string;
  solicitanteCargo: string;
  autorizadorNombre: string;
  autorizadorCargo: string;
  items: CreateValeItemInput[];
}

export interface RegistrarLocalizacionInput {
  estadoBusqueda: 'LOCALIZADO' | 'NO_LOCALIZADO';
  ubicacionEncontrada?: string;
  observaciones?: string;
}

export interface RegistrarEntregaInput {
  receptorEntrega: string;
  entregadoAt: string;
  itemsEntregados: string[];
}
