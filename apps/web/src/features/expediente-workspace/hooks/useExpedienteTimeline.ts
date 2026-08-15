import { useInfiniteQuery } from '@tanstack/react-query';
import { expedienteApi, type ExpedienteApi } from '../api/expedienteApi';

export function useExpedienteTimeline(
  expedienteId: string | null,
  limit = 25,
  api: ExpedienteApi = expedienteApi,
) {
  return useInfiniteQuery({
    queryKey: ['expediente-timeline', expedienteId, limit],
    queryFn: ({ pageParam }) => api.getTimeline(expedienteId!, {
      limit,
      ...(pageParam === null ? {} : { cursor: pageParam }),
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: expedienteId !== null,
  });
}
