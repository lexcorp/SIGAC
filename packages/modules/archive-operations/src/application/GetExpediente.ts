import type { ExpedienteRepository } from './ExpedienteRepository.js';

export class GetExpediente {
  constructor(private readonly repository: ExpedienteRepository) {}

  async execute(id: string) {
    const expediente = await this.repository.findById(id);
    return expediente?.snapshot() ?? null;
  }
}
