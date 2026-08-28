import type { AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { ValeArchivo } from '../../domain/aggregates/ValeArchivo.js';

export interface ValeBatchSourceIdentity {
  readonly kind: 'AGENDA_PREPARATION';
  readonly agendaDate: string;
  readonly sourceImportacionId: string;
  readonly sourceVersion: string;
  readonly generationSnapshotHash: string;
}

export interface ValeBatchIdempotencyKey {
  readonly agendaDate: string;
  readonly sourceImportacionId: string;
  readonly generationSnapshotHash: string;
}

export interface ValeBatchAppointmentReferenceSnapshot {
  readonly folio: string;
  readonly servicioCodigo: string;
  readonly medicoNumeroEmpleado: string;
}

export interface ValeBatchItemTraceSnapshot {
  readonly valeItemId: string;
  readonly expedienteNumero: string;
  readonly appointmentReferences: readonly ValeBatchAppointmentReferenceSnapshot[];
}

export interface ValeBatchTraceSnapshot {
  readonly source: ValeBatchSourceIdentity;
  readonly generatedAt: Date;
  readonly valeId: string;
  readonly numeroVale: string;
  readonly agendaDate: string;
  readonly servicioCodigo: string;
  readonly servicioNombre: string;
  readonly medicoNumeroEmpleado: string;
  readonly medicoNombre: string;
  readonly items: readonly ValeBatchItemTraceSnapshot[];
}

export interface ExistingGeneratedVale {
  readonly valeId: string;
  readonly numeroVale: string;
  readonly agendaDate: string;
  readonly servicioCodigo: string;
  readonly medicoNumeroEmpleado: string;
}

export interface ValeBatchTransaction {
  readonly operationOccurredAt: Date;
  readonly auditWriter: AuditWriter;

  findBySource(key: ValeBatchIdempotencyKey): Promise<readonly ExistingGeneratedVale[]>;
  reserveDailySequence(fechaSolicitud: string): Promise<number>;
  saveVale(vale: ValeArchivo): Promise<void>;
  appendTraceSnapshot(snapshot: ValeBatchTraceSnapshot): Promise<void>;
}

export interface ValeBatchUnitOfWork {
  execute<T>(
    context: RequestContext,
    work: (transaction: ValeBatchTransaction) => Promise<T>,
  ): Promise<T>;
}
