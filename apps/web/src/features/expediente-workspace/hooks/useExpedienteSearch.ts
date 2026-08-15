import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { expedienteApi, type ExpedienteApi } from '../api/expedienteApi';

export function useExpedienteSearch(
  numero: string,
  onSingleResult?: (expedienteId: string) => void,
  api: ExpedienteApi = expedienteApi,
) {
  const query = useQuery({
    queryKey: ['expediente-search', numero],
    queryFn: () => api.searchByNumero(numero),
    enabled: numero.length > 0,
  });
  const items = query.data?.items ?? [];

  useEffect(() => {
    if (items.length === 1) onSingleResult?.(items[0]!.expedienteId);
  }, [items, onSingleResult]);

  return {
    ...query,
    items,
    isDisambiguating: items.length > 1,
  };
}
