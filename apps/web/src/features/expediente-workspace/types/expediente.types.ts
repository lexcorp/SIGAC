export const ESTADOS_OPERATIVOS = [
  'DISPONIBLE',
  'APARTADO',
  'EN_TRASLADO',
  'EN_CONSULTA',
  'NO_LOCALIZADO',
  'EXTRAVIADO',
] as const;
export type EstadoOperativo = (typeof ESTADOS_OPERATIVOS)[number];

export const EXPEDIENTE_CAPABILITIES = [
  'SOLICITAR', 'INICIAR_BUSQUEDA', 'MARCAR_LOCALIZADO', 'MARCAR_NO_LOCALIZADO',
  'DISPATCH', 'ACCEPT_CUSTODY', 'ABRIR_PRESTAMO', 'RENOVAR_PRESTAMO',
  'RECIBIR_DEVOLUCION', 'CONFIRMAR_REARCHIVO', 'REPORTAR_INCIDENCIA',
] as const;
export type ExpedienteCapability = (typeof EXPEDIENTE_CAPABILITIES)[number];

export type Permission =
  | 'REQUEST_CREATE' | 'REQUEST_ASSIGN' | 'SEARCH_START' | 'SEARCH_MARK_LOCATED'
  | 'SEARCH_MARK_NOT_LOCATED' | 'PREPARATION_MARK_READY' | 'CUSTODY_TRANSFER'
  | 'EXPEDIENT_DISPATCH' | 'CUSTODY_ACCEPT' | 'LOAN_OPEN' | 'LOAN_RENEW'
  | 'RETURN_RECEIVE' | 'REARCHIVE_CONFIRM' | 'INCIDENT_OPEN' | 'INCIDENT_RESOLVE'
  | 'EXPEDIENT_VIEW' | 'EXPEDIENT_AUDIT_VIEW' | 'LOCATION_VIEW' | 'REPORT_VIEW'
  | 'ADMIN_CONFIGURE'
  | 'AGENDA_IMPORT' | 'AGENDA_VIEW' | 'AGENDA_INCIDENT_VIEW'
  | 'AGENDA_PRINT';   // T-20 preparation-reports REQ-PR-005

export interface SessionAuthorizationReadModel {
  readonly actorId: string;
  readonly permissions: readonly Permission[];
}

export interface UbicacionDto {
  readonly id: string;
  readonly codigo: string;
  readonly descripcion: string;
}

export interface ExpedienteSearchItem {
  readonly expedienteId: string;
  readonly expedienteNumero: string;
  readonly paciente: {
    readonly idInstitucional: string;
    readonly curp: string;
    readonly nombreOperativo: string;
    readonly numeroIssste: string;
  };
  readonly estadoOperativo: EstadoOperativo;
  readonly ubicacion: UbicacionDto | null;
}

export interface ExpedienteSearchResponse {
  readonly items: readonly ExpedienteSearchItem[];
}

export interface ExpedienteReadModel {
  readonly id: string;
  readonly expedienteNumero: string;
  readonly pacienteRef: { readonly id: string; readonly displayLabel: string };
  readonly estadoOperativo: EstadoOperativo;
  readonly ubicacionActual: UbicacionDto | null;
  readonly custodiaActual: {
    readonly custodioTipo: string;
    readonly custodioRef: string;
    readonly servicio: string | null;
    readonly aceptadaEn: string | null;
  } | null;
  readonly prestamoActivo: {
    readonly prestamoId: string;
    readonly finalidad: string;
    readonly custodioRef: string;
    readonly destinoTipo: string;
    readonly destinoRef: string;
    readonly dueAt: string;
    readonly fuenteHabilitanteSalida: 'CONSULTA_PROGRAMADA' | 'VALE_ARCHIVO_SM_1_14' | 'ORDEN_SUPERIOR';
    readonly estado: 'Activo' | 'Vencido';
  } | null;
  readonly solicitudActiva: {
    readonly solicitudId: string;
    readonly tipo: string;
    readonly origen: string;
    readonly estado: 'Pendiente' | 'Asignada' | 'EnBusqueda' | 'Localizada' | 'Preparada' | 'Entregada' | 'Cancelada' | 'NoLocalizada';
    readonly asignadoA: string | null;
  } | null;
  readonly incidenciasAbiertas: readonly {
    readonly incidenciaId: string;
    readonly tipo: string;
    readonly severidad: string;
    readonly estado: 'Abierta' | 'EnInvestigacion' | 'Escalada';
    readonly resumen: string;
    readonly asignadoA: string | null;
    readonly openedAt: string;
  }[];
  readonly capabilities: readonly ExpedienteCapability[];
  readonly rowVersion: string;
}

export interface MovimientoExpedienteSummary {
  readonly movimientoId: string;
  readonly movementType: string;
  readonly originLocation: string | null;
  readonly destinationLocation: string | null;
  readonly originCustodianRef: string | null;
  readonly destinationCustodianRef: string | null;
  readonly businessReferenceType: string;
  readonly businessReferenceId: string | null;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly actorRef: string;
  readonly source: string;
  readonly correlationId: string | null;
}

export interface TimelinePage {
  readonly items: readonly MovimientoExpedienteSummary[];
  readonly nextCursor: string | null;
}

export interface ExpedienteAuditEntrySummary {
  readonly auditId: string;
  readonly action: string;
  readonly result: 'success' | 'denied' | 'not-found' | 'conflict' | 'invalid-transition';
  readonly actorRef: string;
  readonly occurredAt: string;
  readonly source: 'WEB' | 'INTERNAL';
  readonly requestId: string;
  readonly correlationId: string;
}

export interface ExpedienteAuditPage {
  readonly items: readonly ExpedienteAuditEntrySummary[];
  readonly nextCursor: string | null;
}

export type UbicacionOption = UbicacionDto;
export interface UbicacionesResponse { readonly items: readonly UbicacionOption[] }

export interface DispatchRequest {
  readonly destination: UbicacionDto;
  readonly intendedCustodian: { readonly type: string; readonly reference: string };
  readonly businessReference: { readonly type: string; readonly id: string | null };
  readonly expectedRowVersion: string;
}

export interface AcceptCustodyRequest {
  readonly receptor: {
    readonly type: string;
    readonly reference: string;
    readonly service: string | null;
  };
  readonly ubicacionDestino: UbicacionDto;
  readonly businessReference: { readonly type: string; readonly id: string | null };
  readonly expectedRowVersion: string;
}

export type ProblemCode =
  | 'HTTP_VALIDATION_ERROR'
  | 'AUTHENTICATION_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'INSUFFICIENT_ENABLING_SOURCE'
  | 'EXPEDIENTE_NOT_FOUND'
  | 'OPTIMISTIC_LOCK_CONFLICT'
  | 'REQUEST_INVALID_TRANSITION';

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: ProblemCode;
  readonly detail?: string;
  readonly errors?: readonly {
    readonly field: string;
    readonly code: 'REQUIRED' | 'INVALID_FORMAT' | 'INVALID_TYPE' | 'OUT_OF_RANGE';
  }[];
}
