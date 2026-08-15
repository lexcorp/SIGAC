import { useInfiniteQuery } from '@tanstack/react-query';
import { expedienteApi, type ExpedienteApi } from '../api/expedienteApi';

export function useExpedienteAudit(expedienteId: string | null, authorized: boolean, limit = 25, api: ExpedienteApi = expedienteApi) {
  return useInfiniteQuery({
    queryKey: ['expediente-audit', expedienteId, limit],
    queryFn: ({ pageParam }) => api.getAudit(expedienteId!, { limit, ...(pageParam === null ? {} : { cursor: pageParam }) }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: expedienteId !== null && authorized,
  });
}
