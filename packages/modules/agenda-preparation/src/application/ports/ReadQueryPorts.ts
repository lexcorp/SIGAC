import type { TenantContext } from '@sigac/tenant';
import type { AgendaFecha } from '../../domain/value-objects/index.js';
import type { ImportOutcome } from '../../domain/types/ImportResult.js';
import type { ImportacionAgendaMetrics } from '../../domain/aggregates/ImportacionAgenda.js';

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
export type PreparationOrder =
  | 'APPOINTMENT_TIME_ASC'
  | 'PATIENT_NAME_ASC';

export const DEFAULT_PREPARATION_ORDER: PreparationOrder = 'APPOINTMENT_TIME_ASC';

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
