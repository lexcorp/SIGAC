/**
 * GenerateValesFromAgenda — Application Service de orquestación.
 *
 * Flujo (design.md §11.5):
 *   1. Verificar AGENDA_VIEW + REQUEST_CREATE
 *   2. Leer Agenda preparada via AgendaPreparationReadPort
 *   3. Clasificar no-resolubles (Servicio ausente / Expediente nulo)
 *   4. Agrupar (agendaDate, servicioCodigo, medicoNumeroEmpleado)
 *   5. Deduplicar demandas físicas same-group; detectar cross-group conflicts
 *   6. Aplicar conflictResolutions explícitas
 *   7. Construir snapshot canónico y calcular hash
 *   8. Verificar source version vigente
 *   9. Llamar ValeGenerationPort.generateBatch
 *  10. Devolver resultado sin PII adicional
 *
 * No crea ValeArchivo directamente. No importa @sigac/agenda-preparation
 * ni @sigac/vale-archivo. Solo depende de los ports y contratos del
 * propio módulo neutral más @sigac/tenant.
 */

import type { RequestContext } from '@sigac/tenant';
import type {
  AgendaAgendaItem,
  ValeGroupKey,
  ValeGenerationGroup,
  ValePhysicalDemand,
  ValeAppointmentReference,
  GenerateValesFromAgendaResult,
  ValeGenerationConflict,
  UnresolvedAgendaItem,
  GeneratedValeReference,
  ValeHeaderInput,
  ResolvedValeGenerationConflict,
} from '../contracts/index.js';
import type {
  AgendaPreparationReadPort,
  GenerationSnapshotHasherPort,
  ValeGenerationPort,
} from '../ports/index.js';
import { AgendaValeIntegrationError } from './errors.js';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface GenerateValesFromAgendaInput {
  readonly agendaDate: string;
  readonly header: ValeHeaderInput;
  /**
   * Resoluciones explícitas para expedientes presentes en múltiples grupos.
   * El ownerGroup designa qué grupo recibe la demanda física.
   */
  readonly conflictResolutions?: readonly {
    readonly expedienteReference: string;
    readonly ownerGroup: ValeGroupKey;
  }[];
  readonly context: RequestContext;
}

// ── Dependencies ──────────────────────────────────────────────────────────────

export interface GenerateValesFromAgendaDeps {
  readonly agendaReadPort:  AgendaPreparationReadPort;
  readonly hasherPort:      GenerationSnapshotHasherPort;
  readonly valeGenPort:     ValeGenerationPort;
}

// ── Application Service ───────────────────────────────────────────────────────

export class GenerateValesFromAgenda {
  constructor(private readonly deps: GenerateValesFromAgendaDeps) {}

  async execute(
    input: GenerateValesFromAgendaInput,
  ): Promise<GenerateValesFromAgendaResult> {
    const { agendaDate, header, context } = input;
    const conflictResolutions = input.conflictResolutions ?? [];

    // ── 1. Authorization ──────────────────────────────────────────────────────
    if (
      !context.actor.permissions.has('AGENDA_VIEW') ||
      !context.actor.permissions.has('REQUEST_CREATE')
    ) {
      throw new AgendaValeIntegrationError(
        'PERMISSION_DENIED',
        'AGENDA_VIEW and REQUEST_CREATE are required.',
      );
    }

    // ── 2. Read prepared Agenda ───────────────────────────────────────────────
    const projection = await this.deps.agendaReadPort.findPreparedAgenda(
      agendaDate,
      context.tenant,
    );
    if (projection === null) {
      throw new AgendaValeIntegrationError(
        'AGENDA_NOT_FOUND',
        `No prepared agenda found for date ${agendaDate}.`,
      );
    }

    const { items, sourceImportacionId, sourceVersion } = projection;

    // ── 3. Classify unresolvable items ────────────────────────────────────────
    const unresolvedItems: UnresolvedAgendaItem[] = [];
    const eligibleItems: AgendaAgendaItem[] = [];

    for (const item of items) {
      if (item.servicio.codigo === null || item.servicio.nombre === null) {
        unresolvedItems.push({ folio: item.folio, reason: 'SERVICE_NOT_RESOLVED' });
        continue;
      }
      if (item.expedienteReference === null) {
        unresolvedItems.push({ folio: item.folio, reason: 'EXPEDIENT_NOT_RESOLVED' });
        continue;
      }
      eligibleItems.push(item);
    }

    // ── 4. Group eligible items ────────────────────────────────────────────────
    // Key: (agendaDate, servicioCodigo, medicoNumeroEmpleado) — ADR-0037
    type GroupMap = Map<string, {
      key:            ValeGroupKey;
      servicioNombre: string;
      medicoNombre:   string;
      // expedienteReference → { demand, folios }
      demands: Map<string, { demand: ValePhysicalDemand; folios: string[] }>;
    }>;

    function groupKeyStr(k: ValeGroupKey): string {
      return `${k.agendaDate}|${k.servicioCodigo}|${k.medicoNumeroEmpleado}`;
    }

    const groups: GroupMap = new Map();

    for (const item of eligibleItems) {
      // Guaranteed non-null after classify step
      const k: ValeGroupKey = {
        agendaDate:          item.agendaDate,
        servicioCodigo:      item.servicio.codigo!,
        medicoNumeroEmpleado: item.medico.numeroEmpleado,
      };
      const ks = groupKeyStr(k);

      if (!groups.has(ks)) {
        groups.set(ks, {
          key:            k,
          servicioNombre: item.servicio.nombre!,
          medicoNombre:   item.medico.nombre,
          demands: new Map(),
        });
      }

      const g       = groups.get(ks)!;
      const expRef  = item.expedienteReference!;
      const ref: ValeAppointmentReference = {
        folio:               item.folio,
        servicioCodigo:      k.servicioCodigo,
        medicoNumeroEmpleado: k.medicoNumeroEmpleado,
      };

      if (!g.demands.has(expRef)) {
        // First encounter of this expediente in this group
        g.demands.set(expRef, {
          demand: {
            expedienteReference: expRef,
            pacienteNombre:      item.pacienteNombre,
            references:          [ref],
          },
          folios: [item.folio],
        });
      } else {
        // Same expediente, same group: merge references (dedup same-group)
        const existing = g.demands.get(expRef)!;
        existing.folios.push(item.folio);
        existing.demand = {
          ...existing.demand,
          references: [...existing.demand.references, ref],
        };
        g.demands.set(expRef, existing);
      }
    }

    // ── 5. Detect cross-group conflicts ───────────────────────────────────────
    // An expedienteReference appearing in more than one group is a conflict.
    const expToGroups = new Map<string, {
      key: ValeGroupKey;
      references: readonly ValeAppointmentReference[];
    }[]>();

    for (const g of groups.values()) {
      for (const [expRef, { demand }] of g.demands) {
        const entry = expToGroups.get(expRef) ?? [];
        entry.push({ key: g.key, references: demand.references });
        expToGroups.set(expRef, entry);
      }
    }

    const conflicts: ValeGenerationConflict[] = [];
    const resolvedConflicts: ResolvedValeGenerationConflict[] = [];

    for (const [expRef, groupEntries] of expToGroups) {
      if (groupEntries.length <= 1) continue;

      // Check if there is an explicit resolution
      const resolution = conflictResolutions.find(
        (r) => r.expedienteReference === expRef,
      );

      const ownerIsCandidate = resolution !== undefined && groupEntries.some(
        ({ key }) => groupKeysEqual(key, resolution.ownerGroup),
      );

      if (resolution !== undefined && ownerIsCandidate) {
        resolvedConflicts.push({
          expedienteReference: expRef,
          ownerGroup: resolution.ownerGroup,
          alternatives: groupEntries.map((entry) => ({
            group: entry.key,
            references: entry.references,
          })),
        });
        // Remove from all non-owner groups; keep in owner group
        const ownerStr = groupKeyStr(resolution.ownerGroup);
        for (const g of groups.values()) {
          if (groupKeyStr(g.key) !== ownerStr) {
            g.demands.delete(expRef);
          }
        }
      } else {
        // Missing or invalid owner: fail-closed, remove from generation and report conflict.
        for (const g of groups.values()) {
          g.demands.delete(expRef);
        }
        conflicts.push({
          expedienteReference: expRef,
          candidateGroups:     groupEntries.map((e) => e.key),
          folios:              groupEntries.flatMap((e) => e.references.map((ref) => ref.folio)),
        });
      }
    }

    // ── 6. Build non-empty generation groups ──────────────────────────────────
    const generationGroups: ValeGenerationGroup[] = [];

    for (const g of groups.values()) {
      if (g.demands.size === 0) continue; // skip empty groups (ADR: no group → no number reservation)
      generationGroups.push({
        key:            g.key,
        servicioNombre: g.servicioNombre,
        medicoNombre:   g.medicoNombre,
        items:          [...g.demands.values()].map((d) => d.demand),
      });
    }

    // ── 7. No eligible groups after classification + conflict resolution ───────
    if (generationGroups.length === 0 && unresolvedItems.length === 0 && conflicts.length === 0) {
      return {
        generatedVales: [],
        conflicts:      [],
        unresolvedItems: [],
      };
    }

    if (generationGroups.length === 0) {
      // Only conflicts/unresolved — no batch needed
      return { generatedVales: [], conflicts, unresolvedItems };
    }

    // ── 8. Compute canonical snapshot hash ────────────────────────────────────
    // Sort groups deterministically before hashing to ensure stability
    const sortedGroups = [...generationGroups].sort((a, b) => {
      const cmp = a.key.servicioCodigo.localeCompare(b.key.servicioCodigo);
      return cmp !== 0 ? cmp : a.key.medicoNumeroEmpleado.localeCompare(b.key.medicoNumeroEmpleado);
    });

    const generationSnapshotHash = await this.deps.hasherPort.compute({
      agendaDate,
      sourceImportacionId,
      sourceVersion,
      groups: sortedGroups,
      resolvedConflicts,
    });

    // ── 9. Verify source version is still current ─────────────────────────────
    const isCurrent = await this.deps.agendaReadPort.isCurrentVersion(
      agendaDate,
      sourceImportacionId,
      sourceVersion,
      context.tenant,
    );
    if (!isCurrent) {
      throw new AgendaValeIntegrationError(
        'SOURCE_VERSION_STALE',
        `Agenda ${agendaDate} was reconciled during generation. Retry to use current data.`,
      );
    }

    // ── 10. Call target port ──────────────────────────────────────────────────
    const batchResult = await this.deps.valeGenPort.generateBatch(
      {
        agendaDate,
        sourceImportacionId,
        sourceVersion,
        generationSnapshotHash,
        header,
        groups: sortedGroups,
        resolvedConflicts,
      },
      context,
    );

    // ── 11. Return result (no PII beyond what is already in GeneratedValeReference)
    const generatedVales: GeneratedValeReference[] = batchResult.generatedVales.map(
      (v) => ({ ...v }),
    );

    return { generatedVales, conflicts, unresolvedItems };
  }
}

function groupKeysEqual(left: ValeGroupKey, right: ValeGroupKey): boolean {
  return left.agendaDate === right.agendaDate &&
    left.servicioCodigo === right.servicioCodigo &&
    left.medicoNumeroEmpleado === right.medicoNumeroEmpleado;
}
