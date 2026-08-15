import type { TenantContext } from '@sigac/tenant';

export interface UbicacionOption {
  readonly id: string;
  readonly codigo: string;
  readonly descripcion: string;
}

export interface UbicacionesQueryPort {
  findAll(tenant: TenantContext): Promise<readonly UbicacionOption[]>;
}
