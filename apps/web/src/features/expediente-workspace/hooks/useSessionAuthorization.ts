import { useQuery } from '@tanstack/react-query';
import { expedienteApi, type ExpedienteApi } from '../api/expedienteApi';

export function useSessionAuthorization(api: ExpedienteApi = expedienteApi) {
  return useQuery({ queryKey: ['session-authorization'], queryFn: () => api.getSession() });
}
