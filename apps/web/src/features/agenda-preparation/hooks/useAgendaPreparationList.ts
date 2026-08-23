import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { PreparationOrder } from '../types/agenda.types';
import { agendaApi, type AgendaApi } from '../api/agendaApi';

export function useAgendaPreparationList(
  date: string | null,
  order: PreparationOrder,
  limit = 25,
  api: AgendaApi = agendaApi,
) {
  return useInfiniteQuery({
    queryKey: ['agenda-preparation-list', date, order, limit],
    queryFn: ({ pageParam }) =>
      api.getPreparationList(date!, order, limit, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: date !== null && date.length > 0,
  });
}

export function useAgendaPreparationPrint(
  date: string | null,
  order: PreparationOrder,
  enabled = false,
  api: AgendaApi = agendaApi,
) {
  return useQuery({
    queryKey: ['agenda-preparation-print', date, order],
    queryFn: () => api.printPreparationList(date!, order),
    enabled: enabled && date !== null && date.length > 0,
  });
}
