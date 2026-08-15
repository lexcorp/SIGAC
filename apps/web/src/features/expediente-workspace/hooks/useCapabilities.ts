import type { ExpedienteReadModel } from '../types/expediente.types';

export function useCapabilities(expediente: ExpedienteReadModel | null | undefined) {
  return expediente?.capabilities ?? [];
}
