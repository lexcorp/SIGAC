import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpedienteApi, ExpedienteApiError } from '../api/expedienteApi';
import { readModel, searchItem } from '../expediente.fixtures';
import type { ProblemDetails } from '../types/expediente.types';
import { expedienteQueryKey } from './useExpediente';
import { useExpedienteCommands } from './useExpedienteCommands';
import { useExpedienteSearch } from './useExpedienteSearch';
import { useExpedienteTimeline } from './useExpedienteTimeline';

function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    client,
    wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  };
}

describe('useExpedienteSearch', () => {
  beforeEach(() => vi.restoreAllMocks());

  it.each([
    [0, false, 0],
    [1, false, 1],
    [2, true, 0],
  ])('maneja %i resultados sin asumir unicidad', async (count, disambiguating, selections) => {
    const api = new ExpedienteApi();
    const items = Array.from({ length: count }, (_, index) => searchItem(String(index + 1)));
    const search = vi.spyOn(api, 'searchByNumero').mockResolvedValue({ items });
    const onSingle = vi.fn();
    const { wrapper } = harness();
    const { result } = renderHook(() => useExpedienteSearch('ABC-123/4', onSingle, api), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(search).toHaveBeenCalledWith('ABC-123/4');
    expect(result.current.items).toHaveLength(count);
    expect(result.current.isDisambiguating).toBe(disambiguating);
    expect(onSingle).toHaveBeenCalledTimes(selections);
  });
});

it('useExpedienteTimeline reenvía el cursor opaco sin interpretarlo', async () => {
  const api = new ExpedienteApi();
  const getTimeline = vi.spyOn(api, 'getTimeline')
    .mockResolvedValueOnce({ items: [], nextCursor: 'opaque.cursor/value' })
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  const { wrapper } = harness();
  const { result } = renderHook(() => useExpedienteTimeline('exp-1', 25, api), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await act(async () => { await result.current.fetchNextPage(); });
  expect(getTimeline).toHaveBeenNthCalledWith(2, 'exp-1', { limit: 25, cursor: 'opaque.cursor/value' });
});

describe('useExpedienteCommands', () => {
  const dispatchInput = {
    destination: { id: 'location-2', codigo: 'CONS-2', descripcion: 'Consulta' },
    intendedCustodian: { type: 'MEDICO', reference: 'receiver-1' },
    businessReference: { type: 'VALE', id: null },
  } as const;
  const acceptInput = {
    receptor: { type: 'MEDICO', reference: 'receiver-1', service: null },
    ubicacionDestino: { id: 'location-2', codigo: 'CONS-2', descripcion: 'Consulta' },
    businessReference: { type: 'VALE', id: 'vale-1' },
  } as const;

  it('conserva bigint como string y refresca tras ambos success 204', async () => {
    const api = new ExpedienteApi();
    const dispatch = vi.spyOn(api, 'dispatch').mockResolvedValue();
    const accept = vi.spyOn(api, 'acceptCustody').mockResolvedValue();
    const { client, wrapper } = harness();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useExpedienteCommands('exp-1', '9007199254740993', api), { wrapper });
    await act(async () => { await result.current.dispatchMutation.mutateAsync(dispatchInput); });
    await act(async () => { await result.current.acceptCustodyMutation.mutateAsync(acceptInput); });
    expect(dispatch).toHaveBeenCalledWith('exp-1', { ...dispatchInput, expectedRowVersion: '9007199254740993' });
    expect(accept).toHaveBeenCalledWith('exp-1', { ...acceptInput, expectedRowVersion: '9007199254740993' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: expedienteQueryKey('exp-1') });
  });

  it('en 409 preserva los datos anteriores, muestra conflicto y recarga explícitamente', async () => {
    const api = new ExpedienteApi();
    const problem: ProblemDetails = { type: 'https://sigac/errors/conflict', title: 'Conflict', status: 409, code: 'OPTIMISTIC_LOCK_CONFLICT' };
    vi.spyOn(api, 'dispatch').mockRejectedValue(new ExpedienteApiError(409, problem));
    const { client, wrapper } = harness();
    const previous = readModel();
    client.setQueryData(expedienteQueryKey('exp-1'), previous);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useExpedienteCommands('exp-1', previous.rowVersion, api), { wrapper });
    await act(async () => { await expect(result.current.dispatchMutation.mutateAsync(dispatchInput)).rejects.toBeInstanceOf(ExpedienteApiError); });
    expect(result.current.conflict).toBe(true);
    expect(client.getQueryData(expedienteQueryKey('exp-1'))).toBe(previous);
    await act(async () => { await result.current.reload(); });
    expect(result.current.conflict).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: expedienteQueryKey('exp-1') });
  });
});
