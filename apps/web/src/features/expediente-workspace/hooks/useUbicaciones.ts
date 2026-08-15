import { useQuery } from '@tanstack/react-query';
import { expedienteApi, type ExpedienteApi } from '../api/expedienteApi';

export function useUbicaciones(enabled: boolean, api: ExpedienteApi = expedienteApi) {
  return useQuery({ queryKey: ['ubicaciones'], queryFn: () => api.listUbicaciones(), enabled });
}
