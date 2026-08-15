import type { TenantContext } from '@sigac/tenant';
import type { Expediente } from '../Expediente.js';
import type { ExpedienteId, ExpedienteNumero } from '../value-objects/index.js';

/** Puerto tenant-scoped para persistir y recuperar el aggregate Expediente. */
export interface ExpedienteRepository {
  findById(id: ExpedienteId, tenant: TenantContext): Promise<Expediente | null>;

  findByNumero(
    numero: ExpedienteNumero,
    tenant: TenantContext,
  ): Promise<readonly Expediente[]>;

  save(expediente: Expediente, tenant: TenantContext): Promise<void>;
}
