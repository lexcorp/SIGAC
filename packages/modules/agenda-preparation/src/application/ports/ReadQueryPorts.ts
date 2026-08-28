import type { TenantContext } from '@sigac/tenant';
import type { AgendaFecha } from '../../domain/value-objects/index.js';
import type { ImportOutcome, RecordProcessingResult, ImportIncident } from '../../domain/types/ImportResult.js';
import type { ImportacionAgendaMetrics } from '../../domain/aggregates/ImportacionAgenda.js';
import type { ImportacionAgendaId } from '../../domain/value-objects/index.js';

// PORT-AP-010 — Read ports (PORT-AP-010 / design.md §7 / PREP-AP-003)

// --- Preparation read models (PREP-AP-001) ---

export interface PreparationItem {
  readonly folio: string;
  readonly nombrePaciente: string;
  readonly expediente: {
    readonly original: string;
    readonly reference: string | null;
  };
  readonly tipoDerechohabiente: string;
  readonly tipoConsulta: 'FIRST_TIME' | 'SUBSEQUENT';
  readonly agendaDate: string;
  readonly appointmentTime: string;
  readonly medico: {
    readonly numeroEmpleado: string;
    readonly nombre: string;
  };
  readonly servicioEspecialidad: {
    readonly codigo: string;
    readonly nombre: string;
  };
}

// PREP-AP-002 — Agrupación y órdenes
// T-28.1: SERVICE_MEDICO_HORA_ASC is the operational default (REQ-PR-001 v0.1.2).
export type PreparationOrder =
  | 'APPOINTMENT_TIME_ASC'
  | 'PATIENT_NAME_ASC'
  | 'SERVICE_MEDICO_HORA_ASC';

export const DEFAULT_PREPARATION_ORDER: PreparationOrder = 'SERVICE_MEDICO_HORA_ASC';

// PREP-AP-003 — Screen query y cursor
export interface PreparationPagination {
  readonly cursor?: string;
  readonly limit: number;
}

export interface PreparationPage {
  readonly items: readonly PreparationItem[];
  readonly nextCursor: string | null;
}

export interface PreparationListQueryPort {
  findPage(
    agendaDate: AgendaFecha,
    order: PreparationOrder,
    pagination: PreparationPagination,
    tenant: TenantContext,
  ): Promise<PreparationPage>;

  listForPrint(
    agendaDate: AgendaFecha,
    order: PreparationOrder,
    tenant: TenantContext,
  ): Promise<readonly PreparationItem[]>;
}

// --- Agenda history read models (design.md §9 / REQ-AP-019) ---

export interface AgendaImportHistoryItem {
  readonly importacionId: string;
  readonly agendaDate: string;
  readonly importedAt: Date;
  readonly outcome: ImportOutcome;
  readonly metrics: ImportacionAgendaMetrics;
}

export interface AgendaImportHistoryPage {
  readonly items: readonly AgendaImportHistoryItem[];
  readonly nextCursor: string | null;
}

export interface AgendaImportHistoryQueryPort {
  findAll(
    agendaDate: string | undefined,
    pagination: { readonly cursor?: string; readonly limit: number },
    tenant: TenantContext,
  ): Promise<AgendaImportHistoryPage>;
}

// --- Agenda day read model (design.md §9 / REQ-AP-020) ---

export interface AgendaDayReadModel {
  readonly agendaDate: string;
  readonly latestImportacionId: string;
  readonly latestImportedAt: Date;
  readonly latestOutcome: ImportOutcome;
  readonly activeAppointments: number;
  readonly physicians: number;
  readonly services: number;
  readonly incidentCount: number;
}

export interface AgendaDayQueryPort {
  findByDate(
    fecha: AgendaFecha,
    tenant: TenantContext,
  ): Promise<AgendaDayReadModel | null>;
}

// --- ImportacionAgenda result read models (design.md §9 / REQ-AP-013) ---

export interface ImportacionAgendaSummary {
  readonly importacionId: string;
  readonly agendaDate: string;
  readonly importedAt: Date;
  readonly outcome: ImportOutcome;
  readonly metrics: ImportacionAgendaMetrics;
  readonly hasChanges: boolean;
}

export interface RegistroImportadoResult {
  readonly registroId: string;
  readonly sourcePosition: number;
  readonly folio: string | null;
  readonly processingResult: RecordProcessingResult;
  readonly incidentCodes: readonly ImportIncident[];
}

export interface AgendaImportResult {
  readonly summary: ImportacionAgendaSummary;
  readonly registros: readonly RegistroImportadoResult[];
}

export interface AgendaImportResultQueryPort {
  findById(
    importacionId: ImportacionAgendaId,
    tenant: TenantContext,
  ): Promise<AgendaImportResult | null>;
}

// --- Import incidents read models (design.md §9 / REQ-AP-013) ---

export interface AgendaImportIncidentSummary {
  readonly incidenciaId: string;
  readonly registroId: string;
  readonly sourcePosition: number;
  readonly type: ImportIncident;
}

export interface AgendaImportIncidentsQueryPort {
  findByImportacionId(
    importacionId: ImportacionAgendaId,
    tenant: TenantContext,
  ): Promise<readonly AgendaImportIncidentSummary[]>;
}
