import { useQuery } from '@tanstack/react-query';
import { valeArchivoApi, type ValeArchivoApi } from '../api/valeArchivoApi';

export function useValeArchivoDetail(
  id: string | null,
  api: ValeArchivoApi = valeArchivoApi,
) {
  return useQuery({
    queryKey: ['vale-archivo-detail', id],
    queryFn: () => api.getVale(id!),
    enabled: id !== null,
    staleTime: 10_000,
  });
}
