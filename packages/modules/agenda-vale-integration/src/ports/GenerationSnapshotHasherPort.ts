import type { ValeGenerationGroup } from '../contracts/ValeGenerationResult.js';

export interface GenerationSnapshotInput {
  readonly agendaDate: string;
  readonly sourceImportacionId: string;
  readonly sourceVersion: string;
  readonly groups: readonly ValeGenerationGroup[];
}

/** Genera metadata técnica opaca; no define una identidad Domain. */
export interface GenerationSnapshotHasherPort {
  compute(input: GenerationSnapshotInput): Promise<string>;
}
