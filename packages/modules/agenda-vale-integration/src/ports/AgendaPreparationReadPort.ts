import type { TenantContext } from '@sigac/tenant';
import type { AgendaPreparationProjection } from '../contracts/AgendaPreparationProjection.js';

/** ACL source: consulta Agenda preparada sin filtrar su modelo Domain. */
export interface AgendaPreparationReadPort {
  findPreparedAgenda(
    agendaDate: string,
    tenant: TenantContext,
  ): Promise<AgendaPreparationProjection | null>;

  isCurrentVersion(
    agendaDate: string,
    sourceImportacionId: string,
    sourceVersion: string,
    tenant: TenantContext,
  ): Promise<boolean>;
}
