import type { AgendaFecha } from '../../domain/value-objects/index.js';

// PORT-AP-001 — Input agnóstico del artefacto
export interface AgendaFileInput {
  readonly sizeBytes: number | null;
  open(): AsyncIterable<Uint8Array>;
}

// PORT-AP-002 — Fingerprint e inspección
export interface ImportFingerprint {
  readonly value: string;
}

export interface AgendaFileInspection {
  readonly fingerprint: ImportFingerprint;
  readonly layout: string;
  readonly agendaDate: AgendaFecha;
  readonly receivedRecords: number;
}

// PORT-AP-003 — Parser/inspection port
export interface AgendaFileInterpreterPort {
  inspect(input: AgendaFileInput): Promise<AgendaFileInspection>;
}
