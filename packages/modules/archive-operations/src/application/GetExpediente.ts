import type { TenantContext } from '@sigac/tenant';
import type { ExpedienteId } from '../domain/value-objects/index.js';
import type { ExpedienteRepository } from '../domain/ports/ExpedienteRepository.js';

export class GetExpediente {
  constructor(private readonly repository: ExpedienteRepository) {}

  async execute(id: ExpedienteId, tenant: TenantContext) {
    const expediente = await this.repository.findById(id, tenant);
    return expediente?.snapshot() ?? null;
  }
}
