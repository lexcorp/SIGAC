import { createHash } from 'node:crypto';
import type {
  GenerationSnapshotHasherPort,
  GenerationSnapshotInput,
} from '../ports/GenerationSnapshotHasherPort.js';
import type {
  ResolvedValeGenerationConflict,
  ValeGenerationGroup,
} from '../contracts/ValeGenerationResult.js';

/** Hasher puro ADR-0041: SHA-256 lowercase hex sobre RFC 8785/JCS. */
export class AgendaSnapshotHasher implements GenerationSnapshotHasherPort {
  async compute(input: GenerationSnapshotInput): Promise<string> {
    const snapshot = {
      agendaDate: input.agendaDate,
      sourceImportacionId: input.sourceImportacionId,
      sourceVersion: input.sourceVersion,
      groups: sortGroups(input.groups).map((group) => ({
        key: { ...group.key },
        servicioNombre: group.servicioNombre,
        medicoNombre: group.medicoNombre,
        items: sortItems(group.items).map((item) => ({
          expedienteReference: item.expedienteReference,
          pacienteNombre: item.pacienteNombre,
          references: sortReferences(item.references).map((reference) => ({ ...reference })),
        })),
      })),
      resolvedConflicts: sortResolvedConflicts(input.resolvedConflicts).map((conflict) => ({
        expedienteReference: conflict.expedienteReference,
        ownerGroup: { ...conflict.ownerGroup },
        alternatives: sortAlternatives(conflict.alternatives).map((alternative) => ({
          group: { ...alternative.group },
          references: sortReferences(alternative.references).map((reference) => ({ ...reference })),
        })),
      })),
    };

    return createHash('sha256')
      .update(canonicalizeJson(snapshot), 'utf8')
      .digest('hex');
  }
}

function sortResolvedConflicts(
  conflicts: readonly ResolvedValeGenerationConflict[],
): readonly ResolvedValeGenerationConflict[] {
  return [...conflicts].sort((left, right) => compareCodePoints(
    left.expedienteReference,
    right.expedienteReference,
  ));
}

function sortAlternatives(
  alternatives: readonly ResolvedValeGenerationConflict['alternatives'][number][],
) {
  return [...alternatives].sort((left, right) => compareTuple(
    [left.group.agendaDate, left.group.servicioCodigo, left.group.medicoNumeroEmpleado],
    [right.group.agendaDate, right.group.servicioCodigo, right.group.medicoNumeroEmpleado],
  ));
}

function sortGroups(groups: readonly ValeGenerationGroup[]): readonly ValeGenerationGroup[] {
  return [...groups].sort((left, right) =>
    compareTuple(
      [left.key.agendaDate, left.key.servicioCodigo, left.key.medicoNumeroEmpleado],
      [right.key.agendaDate, right.key.servicioCodigo, right.key.medicoNumeroEmpleado],
    ),
  );
}

function sortItems(items: readonly ValeGenerationGroup['items'][number][]) {
  return [...items].sort((left, right) => compareCodePoints(
    left.expedienteReference,
    right.expedienteReference,
  ));
}

function sortReferences(
  references: readonly ValeGenerationGroup['items'][number]['references'][number][],
) {
  return [...references].sort((left, right) =>
    compareTuple(
      [left.folio, left.servicioCodigo, left.medicoNumeroEmpleado],
      [right.folio, right.servicioCodigo, right.medicoNumeroEmpleado],
    ),
  );
}

function compareTuple(left: readonly string[], right: readonly string[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const comparison = compareCodePoints(left[index]!, right[index]!);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0)!);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0)!);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

function canonicalizeJson(value: JsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JCS does not allow non-finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(',')}]`;

  const object = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(object[key]!)}`)
    .join(',')}}`;
}
