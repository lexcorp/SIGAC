import { useInfiniteQuery } from '@tanstack/react-query';
import { agendaApi, type AgendaApi } from '../api/agendaApi';

export function useAgendaImportIncidents(
  importacionId: string | null,
  authorized: boolean,
  limit = 25,
  api: AgendaApi = agendaApi,
) {
  return useInfiniteQuery({
    queryKey: ['agenda-import-incidents', importacionId, limit],
    queryFn: ({ pageParam }) =>
      api.getImportIncidents(importacionId!, limit, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: importacionId !== null && authorized,
  });
}
