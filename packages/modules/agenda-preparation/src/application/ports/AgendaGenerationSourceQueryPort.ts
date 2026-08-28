import type { TenantContext } from '@sigac/tenant';
import type { AgendaFecha } from '../../domain/value-objects/index.js';
import type { PreparationItem } from './ReadQueryPorts.js';

/**
 * Proyección interna mínima para construir el source snapshot de generación.
 *
 * El futuro adapter de infraestructura debe retornar exclusivamente Citas ACTIVA y la
 * última importación confirmada que representa el estado vigente de la Agenda.
 */
export interface PreparedAgendaGenerationRecord {
  readonly sourceImportacionId: string;
  readonly items: readonly PreparationItem[];
}

export interface AgendaGenerationSourceQueryPort {
  findCurrentByDate(
    agendaDate: AgendaFecha,
    tenant: TenantContext,
  ): Promise<PreparedAgendaGenerationRecord | null>;
}
