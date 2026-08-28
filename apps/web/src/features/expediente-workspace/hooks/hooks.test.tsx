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
import { useExpedienteAudit } from './useExpedienteAudit';
import { useSessionAuthorization } from './useSessionAuthorization';

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

it('useExpedienteAudit permanece fail-closed y reenvía el cursor opaco al autorizarse', async () => {
  const api = new ExpedienteApi();
  const getAudit = vi.spyOn(api, 'getAudit')
    .mockResolvedValueOnce({ items: [], nextCursor: 'opaque.audit/value' })
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  const { wrapper } = harness();
  const { result, rerender } = renderHook(({ authorized }) => useExpedienteAudit('exp-1', authorized, 25, api), { initialProps: { authorized: false }, wrapper });
  expect(result.current.fetchStatus).toBe('idle');
  expect(getAudit).not.toHaveBeenCalled();
  rerender({ authorized: true });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await act(async () => { await result.current.fetchNextPage(); });
  expect(getAudit).toHaveBeenNthCalledWith(2, 'exp-1', { limit: 25, cursor: 'opaque.audit/value' });
});

it('useSessionAuthorization consume únicamente el read model server-derived', async () => {
  const api = new ExpedienteApi();
  vi.spyOn(api, 'getSession').mockResolvedValue({ actorId: 'actor-1', permissions: ['EXPEDIENT_AUDIT_VIEW'] });
  const { wrapper } = harness();
  const { result } = renderHook(() => useSessionAuthorization(api), { wrapper });
  await waitFor(() => expect(result.current.data).toEqual({ actorId: 'actor-1', permissions: ['EXPEDIENT_AUDIT_VIEW'] }));
  expect(result.current.data).not.toHaveProperty('roles');
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

// ── Regresión Fix 1: segundo clic en "Buscar" no limpia los resultados ────────
// El hook debe devolver los mismos items si el número no cambió.
// React Query devuelve datos del caché mientras refetcha.

describe('useExpedienteSearch — regresión segundo clic (Fix 1)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('misma queryKey → mismos datos del caché en segunda llamada', async () => {
    const api = new ExpedienteApi();
    const item = searchItem('PERR-001');
    const search = vi.spyOn(api, 'searchByNumero').mockResolvedValue({ items: [item] });
    const onSingle = vi.fn();
    const { wrapper, client } = harness();

    // Primera búsqueda
    const { result, rerender } = renderHook(
      ({ numero }: { numero: string }) => useExpedienteSearch(numero, onSingle, api),
      { wrapper, initialProps: { numero: 'PERR810604/10' } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.items).toHaveLength(1);
    const firstItems = result.current.items;

    // Segunda búsqueda con el mismo número — simula el segundo clic
    // React Query retorna los datos del caché (staleWhileRevalidate)
    rerender({ numero: 'PERR810604/10' });
    // Datos deben seguir disponibles (no undefined, no vacíos)
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]!.expedienteId).toBe(firstItems[0]!.expedienteId);

    // La API puede llamarse 1 o 2 veces (caché stale), pero el resultado es el mismo
    expect(search).toHaveBeenCalledWith('PERR810604/10');

    void client; // lint: used in harness
  });

  it('cambiar el número sí produce resultados distintos', async () => {
    const api = new ExpedienteApi();
    const item1 = searchItem('DEMO-001');
    const item2 = searchItem('DEMO-002');
    vi.spyOn(api, 'searchByNumero')
      .mockResolvedValueOnce({ items: [item1] })
      .mockResolvedValueOnce({ items: [item2] });
    const { wrapper } = harness();

    const { result, rerender } = renderHook(
      ({ numero }: { numero: string }) => useExpedienteSearch(numero, undefined, api),
      { wrapper, initialProps: { numero: 'DEMO010101/10' } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.items[0]!.expedienteId).toBe('DEMO-001');

    rerender({ numero: 'DEMO020202/20' });
    await waitFor(() => expect(result.current.items[0]!.expedienteId).toBe('DEMO-002'));
  });

  it('búsqueda que no existe devuelve array vacío (no regresión)', async () => {
    const api = new ExpedienteApi();
    vi.spyOn(api, 'searchByNumero').mockResolvedValue({ items: [] });
    const { wrapper } = harness();

    const { result } = renderHook(
      () => useExpedienteSearch('XXXX999999/10', undefined, api),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.items).toHaveLength(0);
    expect(result.current.isDisambiguating).toBe(false);
  });
});
