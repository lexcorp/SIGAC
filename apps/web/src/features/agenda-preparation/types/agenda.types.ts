export type AgendaPermission = 'AGENDA_IMPORT' | 'AGENDA_VIEW' | 'AGENDA_INCIDENT_VIEW';

export type ImportOutcome = 'IMPORTED' | 'ALREADY_IMPORTED' | 'RECONCILED';

export type RecordProcessingResult =
  | 'ADDED' | 'UPDATED' | 'UNCHANGED' | 'RESTORED'
  | 'PENDING_REVIEW' | 'REJECTED' | 'DUPLICATE_FOLIO';

export type ImportIncident =
  | 'PHYSICIAN_NOT_RESOLVED' | 'PHYSICIAN_AMBIGUOUS' | 'SERVICE_NOT_RESOLVED'
  | 'EXPEDIENT_NOT_RESOLVED' | 'REQUIRED_DATA_MISSING' | 'ROW_INCONSISTENT'
  | 'DUPLICATE_FOLIO_IN_SNAPSHOT';

export type PreparationOrder = 'APPOINTMENT_TIME_ASC' | 'PATIENT_NAME_ASC';

export interface AgendaImportMetrics {
  readonly receivedRecords: number;
  readonly processed: number;
  readonly added: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly restored: number;
  readonly pendingReview: number;
  readonly rejected: number;
  readonly duplicateFolio: number;
  readonly withdrawnFromAgenda: number;
  readonly incidents: number;
  readonly errors: number;
}

export interface AgendaDayReadModel {
  readonly agendaDate: string;
  readonly latestImportacionId: string;
  readonly latestImportedAt: string;
  readonly latestOutcome: ImportOutcome;
  readonly activeAppointments: number;
  readonly physicians: number;
  readonly services: number;
  readonly incidentCount: number;
}

export interface AgendaImportSummary {
  readonly importacionId: string;
  readonly agendaDate: string;
  readonly importedAt: string;
  readonly outcome: ImportOutcome;
  readonly metrics: AgendaImportMetrics;
}

export interface AgendaImportResponse {
  readonly importacionId: string;
  readonly agendaDate: string;
  readonly importedAt: string;
  readonly outcome: ImportOutcome;
  readonly metrics: AgendaImportMetrics;
}

export interface AgendaImportHistoryPage {
  readonly items: readonly AgendaImportSummary[];
  readonly nextCursor: string | null;
}

export interface RegistroImportadoResult {
  readonly registroId: string;
  readonly sourcePosition: number;
  readonly folio: string | null;
  readonly processingResult: RecordProcessingResult;
  readonly incidentCodes: readonly ImportIncident[];
}

export interface AgendaImportDetail {
  readonly summary: AgendaImportSummary;
  readonly registros: readonly RegistroImportadoResult[];
}

export interface AgendaImportIncidentSummary {
  readonly incidenciaId: string;
  readonly registroId: string;
  readonly sourcePosition: number;
  readonly type: ImportIncident;
}

export interface AgendaImportIncidentsPage {
  readonly items: readonly AgendaImportIncidentSummary[];
  readonly nextCursor: string | null;
}

export interface PreparationItem {
  readonly folio: string;
  readonly nombrePaciente: string;
  readonly expediente: { readonly original: string; readonly reference: string | null };
  readonly tipoDerechohabiente: string;
  readonly tipoConsulta: 'FIRST_TIME' | 'SUBSEQUENT';
  readonly agendaDate: string;
  readonly appointmentTime: string;
  readonly medico: { readonly numeroEmpleado: string; readonly nombre: string };
  readonly servicioEspecialidad: { readonly codigo: string; readonly nombre: string };
}

export interface AgendaPreparationPage {
  readonly items: readonly PreparationItem[];
  readonly nextCursor: string | null;
}

export interface AgendaPreparationPrintResponse {
  readonly items: readonly PreparationItem[];
}

export type AgendaProblemCode =
  | 'HTTP_VALIDATION_ERROR' | 'AUTHENTICATION_REQUIRED' | 'PERMISSION_DENIED'
  | 'AGENDA_IMPORT_NOT_FOUND' | 'AGENDA_NOT_FOUND' | 'IDEMPOTENCY_KEY_REUSED'
  | 'AGENDA_UPLOAD_TOO_LARGE' | 'AGENDA_ARTIFACT_UNSUPPORTED' | 'AGENDA_LAYOUT_REJECTED'
  | 'AGENDA_IMPORT_FAILED' | 'AGENDA_IMPORT_TIMEOUT';

export interface AgendaProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: AgendaProblemCode;
  readonly detail?: string;
  readonly importAttemptId?: string;
}
