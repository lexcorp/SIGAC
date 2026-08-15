import type { Expediente } from '../domain/Expediente.js';

export interface ExpedienteRepository {
  findById(id: string): Promise<Expediente | null>;
  findByNumero(numero: string): Promise<Expediente | null>;
}
