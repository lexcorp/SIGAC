import { useQuery } from '@tanstack/react-query';
import { expedienteApi, type ExpedienteApi } from '../api/expedienteApi';

export const expedienteQueryKey = (id: string) => ['expediente', id] as const;

export function useExpediente(id: string | null, api: ExpedienteApi = expedienteApi) {
  return useQuery({
    queryKey: expedienteQueryKey(id ?? ''),
    queryFn: () => api.getById(id!),
    enabled: id !== null,
  });
}
