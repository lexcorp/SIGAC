import { useInfiniteQuery } from '@tanstack/react-query';
import { valeArchivoApi, type ValeArchivoApi } from '../api/valeArchivoApi';
import type { EstadoVale } from '../types/vale-archivo.types';

export interface ValeArchivoListFilter {
  estado?: EstadoVale;
  fecha?: string;
  unidad?: string;
}

export function useValeArchivoList(
  filter: ValeArchivoListFilter = {},
  enabled = true,
  api: ValeArchivoApi = valeArchivoApi,
) {
  return useInfiniteQuery({
    queryKey: ['vale-archivo-list', filter],
    queryFn: ({ pageParam }) =>
      api.listVales({ limit: 20, cursor: pageParam ?? undefined, ...filter }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}
