import { useQuery } from '@tanstack/react-query';
import { agendaApi, type AgendaApi } from '../api/agendaApi';

export function useAgendaDay(date: string | null, api: AgendaApi = agendaApi) {
  return useQuery({
    queryKey: ['agenda-day', date],
    queryFn: () => api.getAgendaDay(date!),
    enabled: date !== null && date.length > 0,
  });
}
