import { createHash } from 'node:crypto';
import type { TenantContext } from '@sigac/tenant';
import type { AgendaFecha } from '../domain/value-objects/index.js';
import type { PreparationItem } from './ports/ReadQueryPorts.js';
import type { AgendaGenerationSourceQueryPort } from './ports/AgendaGenerationSourceQueryPort.js';

export interface PreparedAgendaGenerationSource {
  readonly agendaDate: string;
  readonly sourceImportacionId: string;
  readonly sourceVersion: string;
  readonly items: readonly PreparedAgendaGenerationItem[];
}

export interface PreparedAgendaGenerationItem {
  readonly folio: string;
  readonly agendaDate: string;
  readonly appointmentTime: string;
  readonly tipoConsulta: 'FIRST_TIME' | 'SUBSEQUENT';
  readonly tipoDerechohabiente: string;
  readonly pacienteNombre: string;
  readonly expedienteReference: string | null;
  readonly medico: {
    readonly numeroEmpleado: string;
    readonly nombre: string;
  };
  readonly servicio: {
    readonly codigo: string | null;
    readonly nombre: string | null;
  };
}

export interface GetPreparedAgendaGenerationSourceInput {
  readonly agendaDate: AgendaFecha;
  readonly tenant: TenantContext;
}

export interface VerifyPreparedAgendaGenerationSourceInput
  extends GetPreparedAgendaGenerationSourceInput {
  readonly sourceImportacionId: string;
  readonly sourceVersion: string;
}

export interface GetPreparedAgendaGenerationSourceDependencies {
  readonly queryPort: AgendaGenerationSourceQueryPort;
}

/**
 * Application query propietario de Agenda Preparation para el ACL de generación.
 * No autoriza: recibe TenantContext ya validado desde el orquestador neutral.
 */
export class GetPreparedAgendaGenerationSource {
  constructor(private readonly deps: GetPreparedAgendaGenerationSourceDependencies) {}

  async execute(
    input: GetPreparedAgendaGenerationSourceInput,
  ): Promise<PreparedAgendaGenerationSource | null> {
    const record = await this.deps.queryPort.findCurrentByDate(
      input.agendaDate,
      input.tenant,
    );
    if (record === null) return null;

    const items = sortItemsByFolio(record.items.map(toGenerationItem));
    const source = {
      agendaDate: input.agendaDate.value,
      sourceImportacionId: record.sourceImportacionId,
      items,
    };

    return Object.freeze({
      ...source,
      sourceVersion: computeAgendaSourceVersion(source),
    });
  }

  async isCurrentVersion(
    input: VerifyPreparedAgendaGenerationSourceInput,
  ): Promise<boolean> {
    const current = await this.execute(input);
    return current !== null &&
      current.sourceImportacionId === input.sourceImportacionId &&
      current.sourceVersion === input.sourceVersion;
  }
}

interface CanonicalAgendaSource {
  readonly agendaDate: string;
  readonly sourceImportacionId: string;
  readonly items: readonly PreparedAgendaGenerationItem[];
}

/** ADR-0041: SHA-256 lowercase hex de JCS/RFC 8785 sobre el snapshot canónico. */
export function computeAgendaSourceVersion(source: CanonicalAgendaSource): string {
  const canonicalSource = {
    agendaDate: source.agendaDate,
    sourceImportacionId: source.sourceImportacionId,
    items: sortItemsByFolio(source.items).map(toCanonicalItem),
  };

  return createHash('sha256')
    .update(canonicalizeJson(canonicalSource), 'utf8')
    .digest('hex');
}

function sortItemsByFolio(
  items: readonly PreparedAgendaGenerationItem[],
): readonly PreparedAgendaGenerationItem[] {
  return Object.freeze([...items].sort((left, right) =>
    compareUnicodeCodePoints(left.folio, right.folio),
  ));
}

function toGenerationItem(item: PreparationItem): PreparedAgendaGenerationItem {
  return Object.freeze({
    folio: item.folio,
    agendaDate: item.agendaDate,
    appointmentTime: item.appointmentTime,
    tipoConsulta: item.tipoConsulta,
    tipoDerechohabiente: item.tipoDerechohabiente,
    pacienteNombre: item.nombrePaciente,
    expedienteReference: item.expediente.reference,
    medico: Object.freeze({ ...item.medico }),
    servicio: Object.freeze({ ...item.servicioEspecialidad }),
  });
}

function toCanonicalItem(item: PreparedAgendaGenerationItem): JsonValue {
  return {
    folio: item.folio,
    agendaDate: item.agendaDate,
    appointmentTime: item.appointmentTime,
    tipoConsulta: item.tipoConsulta,
    tipoDerechohabiente: item.tipoDerechohabiente,
    pacienteNombre: item.pacienteNombre,
    expedienteReference: item.expedienteReference,
    medico: {
      numeroEmpleado: item.medico.numeroEmpleado,
      nombre: item.medico.nombre,
    },
    servicio: {
      codigo: item.servicio.codigo,
      nombre: item.servicio.nombre,
    },
  };
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Subconjunto JCS suficiente para el contrato JSON cerrado de ADR-0041. */
function canonicalizeJson(value: JsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JCS does not allow non-finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(',')}]`;
  }

  const object = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(object[key]!)}`)
    .join(',')}}`;
}

function compareUnicodeCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0)!);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0)!);
  const length = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}
