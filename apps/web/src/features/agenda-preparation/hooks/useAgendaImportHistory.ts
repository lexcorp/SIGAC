import { useInfiniteQuery } from '@tanstack/react-query';
import { agendaApi, type AgendaApi } from '../api/agendaApi';

export function useAgendaImportHistory(
  agendaDateFilter: string | undefined,
  limit = 20,
  api: AgendaApi = agendaApi,
) {
  return useInfiniteQuery({
    queryKey: ['agenda-import-history', agendaDateFilter, limit],
    queryFn: ({ pageParam }) =>
      api.listImports(limit, pageParam ?? undefined, agendaDateFilter),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: true,
  });
}
