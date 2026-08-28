import type {
  ValeGroupKey,
  ValeHeaderInput,
} from './AgendaPreparationProjection.js';

export interface ValeAppointmentReference {
  readonly folio: string;
  readonly servicioCodigo: string;
  readonly medicoNumeroEmpleado: string;
}

/** Una sola demanda física, potencialmente respaldada por varias Citas. */
export interface ValePhysicalDemand {
  readonly expedienteReference: string;
  readonly pacienteNombre: string;
  readonly references: readonly ValeAppointmentReference[];
}

export interface ValeGenerationGroup {
  readonly key: ValeGroupKey;
  readonly servicioNombre: string;
  readonly medicoNombre: string;
  readonly items: readonly ValePhysicalDemand[];
}

export interface ValeGenerationBatchCommand {
  readonly agendaDate: string;
  readonly sourceImportacionId: string;
  readonly sourceVersion: string;
  readonly generationSnapshotHash: string;
  readonly header: ValeHeaderInput;
  readonly groups: readonly ValeGenerationGroup[];
}

export type ValeGenerationOutcome = 'GENERATED' | 'ALREADY_GENERATED';

export interface GeneratedValeReference {
  readonly valeId: string;
  readonly numeroVale: string;
  readonly group: ValeGroupKey;
  readonly outcome: ValeGenerationOutcome;
}

export interface ValeGenerationConflict {
  readonly expedienteReference: string;
  readonly candidateGroups: readonly ValeGroupKey[];
  readonly folios: readonly string[];
}

export type UnresolvedAgendaItemReason =
  | 'EXPEDIENT_NOT_RESOLVED'
  | 'SERVICE_NOT_RESOLVED';

export interface UnresolvedAgendaItem {
  readonly folio: string;
  readonly reason: UnresolvedAgendaItemReason;
}

export interface ValeGenerationBatchResult {
  readonly generatedVales: readonly GeneratedValeReference[];
}

export interface GenerateValesFromAgendaResult
  extends ValeGenerationBatchResult {
  readonly conflicts: readonly ValeGenerationConflict[];
  readonly unresolvedItems: readonly UnresolvedAgendaItem[];
}
