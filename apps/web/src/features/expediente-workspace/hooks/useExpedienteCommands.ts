import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expedienteApi, ExpedienteApiError, type ExpedienteApi } from '../api/expedienteApi';
import type { AcceptCustodyRequest, DispatchRequest } from '../types/expediente.types';
import { expedienteQueryKey } from './useExpediente';

export function useExpedienteCommands(
  expedienteId: string,
  rowVersion: string,
  api: ExpedienteApi = expedienteApi,
) {
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState(false);

  const handleError = (error: unknown) => {
    if (error instanceof ExpedienteApiError && error.problem?.code === 'OPTIMISTIC_LOCK_CONFLICT') {
      setConflict(true);
    }
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: expedienteQueryKey(expedienteId) });

  const dispatchMutation = useMutation({
    mutationFn: (input: Omit<DispatchRequest, 'expectedRowVersion'>) => api.dispatch(expedienteId, {
      ...input,
      expectedRowVersion: rowVersion,
    }),
    onSuccess: refresh,
    onError: handleError,
  });
  const acceptCustodyMutation = useMutation({
    mutationFn: (input: Omit<AcceptCustodyRequest, 'expectedRowVersion'>) => api.acceptCustody(expedienteId, {
      ...input,
      expectedRowVersion: rowVersion,
    }),
    onSuccess: refresh,
    onError: handleError,
  });

  async function reload() {
    setConflict(false);
    await queryClient.invalidateQueries({ queryKey: expedienteQueryKey(expedienteId) });
  }

  return { dispatchMutation, acceptCustodyMutation, conflict, reload };
}
