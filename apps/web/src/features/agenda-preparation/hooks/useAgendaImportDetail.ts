import { useQuery } from '@tanstack/react-query';
import { agendaApi, type AgendaApi } from '../api/agendaApi';

export function useAgendaImportDetail(
  importacionId: string | null,
  api: AgendaApi = agendaApi,
) {
  return useQuery({
    queryKey: ['agenda-import-detail', importacionId],
    queryFn: () => api.getImportDetail(importacionId!),
    enabled: importacionId !== null,
  });
}
