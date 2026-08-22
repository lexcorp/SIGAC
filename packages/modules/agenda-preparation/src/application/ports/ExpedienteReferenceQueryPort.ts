import type { TenantContext } from '@sigac/tenant';
import type { ExpedienteReferencia } from '../../domain/value-objects/index.js';

// PORT-AP-005 — Referencia cross-context de Expediente
export interface ExpedienteReferenceInput {
  readonly expedienteNumero: string;
}

export interface ExpedienteReferenceMatch {
  readonly reference: ExpedienteReferencia;
}

export interface ExpedienteReferenceQueryPort {
  resolve(
    input: ExpedienteReferenceInput,
    tenant: TenantContext,
  ): Promise<readonly ExpedienteReferenceMatch[]>;
}
