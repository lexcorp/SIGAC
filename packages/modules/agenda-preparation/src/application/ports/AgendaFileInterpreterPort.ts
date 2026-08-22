import type { AgendaFecha } from '../../domain/value-objects/index.js';
import type {
  RegistroImportadoAgendaOriginalValues,
  RegistroImportadoAgendaInterpretedValues,
} from '../../domain/entities/RegistroImportadoAgenda.js';

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

// PORT-AP-003a — Parsed row (filas neutrales para Application)
export interface ParsedAgendaRow {
  readonly sourcePosition: number;
  readonly originalValues: RegistroImportadoAgendaOriginalValues;
  readonly interpretedValues: RegistroImportadoAgendaInterpretedValues;
}

export interface InterpretedAgendaFile {
  readonly fingerprint: ImportFingerprint;
  readonly layout: string;
  readonly agendaDate: AgendaFecha;
  readonly rows: readonly ParsedAgendaRow[];
}

// PORT-AP-003 — Parser/inspection port
export interface AgendaFileInterpreterPort {
  inspect(input: AgendaFileInput): Promise<AgendaFileInspection>;
  interpret(input: AgendaFileInput): Promise<InterpretedAgendaFile>;
}
