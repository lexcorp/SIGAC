import type { TenantContext } from '@sigac/tenant';
import type { MedicoReferencia, NumeroEmpleado } from '../../domain/value-objects/index.js';

// PORT-AP-004 — Resolución de médico
export type MedicoResolution =
  | { readonly kind: 'RESOLVED'; readonly medico: MedicoReferencia }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'AMBIGUOUS' };

export interface MedicoDirectoryQueryPort {
  findByEmployeeNumber(
    numero: NumeroEmpleado,
    tenant: TenantContext,
  ): Promise<MedicoResolution>;

  findControlledFallback(
    nombreOriginal: string,
    tenant: TenantContext,
  ): Promise<MedicoResolution>;
}
