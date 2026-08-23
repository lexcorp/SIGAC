import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AgendaDayReadModel } from '../types/agenda.types';
import { useAgendaDay } from './useAgendaDay';
import { useAgendaImportHistory } from './useAgendaImportHistory';
import { useAgendaImportIncidents } from './useAgendaImportIncidents';
import { useAgendaPreparationList } from './useAgendaPreparationList';

function wrapper({ children }: { readonly children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const sampleDay: AgendaDayReadModel = {
  agendaDate: '2026-08-25',
  latestImportacionId: 'imp-001',
  latestImportedAt: '2026-08-25T10:00:00Z',
  latestOutcome: 'IMPORTED',
  activeAppointments: 3,
  physicians: 1,
  services: 1,
  incidentCount: 0,
};

describe('useAgendaDay', () => {
  it('does not fetch when date is null', () => {
    const api = { getAgendaDay: vi.fn() };
    const { result } = renderHook(
      () => useAgendaDay(null, api as unknown as Parameters<typeof useAgendaDay>[1]),
      { wrapper },
    );
    expect(result.current.isFetching).toBe(false);
    expect(api.getAgendaDay).not.toHaveBeenCalled();
  });

  it('fetches agenda day and returns data', async () => {
    const api = { getAgendaDay: vi.fn().mockResolvedValue(sampleDay) };
    const { result } = renderHook(
      () => useAgendaDay('2026-08-25', api as unknown as Parameters<typeof useAgendaDay>[1]),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleDay);
  });
});

describe('useAgendaPreparationList', () => {
  it('does not fetch when date is null', () => {
    const api = { getPreparationList: vi.fn() };
    const { result } = renderHook(
      () =>
        useAgendaPreparationList(
          null,
          'APPOINTMENT_TIME_ASC',
          25,
          api as unknown as Parameters<typeof useAgendaPreparationList>[3],
        ),
      { wrapper },
    );
    expect(result.current.isFetching).toBe(false);
    expect(api.getPreparationList).not.toHaveBeenCalled();
  });

  it('fetches with correct order and no cursor initially', async () => {
    const api = {
      getPreparationList: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };
    const { result } = renderHook(
      () =>
        useAgendaPreparationList(
          '2026-08-25',
          'PATIENT_NAME_ASC',
          25,
          api as unknown as Parameters<typeof useAgendaPreparationList>[3],
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.getPreparationList).toHaveBeenCalledWith(
      '2026-08-25',
      'PATIENT_NAME_ASC',
      25,
      undefined,
    );
    expect(result.current.data?.pages[0]?.items).toEqual([]);
  });
});

describe('useAgendaImportHistory', () => {
  it('fetches immediately regardless of date filter', async () => {
    const api = {
      listImports: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };
    const { result } = renderHook(
      () =>
        useAgendaImportHistory(
          undefined,
          20,
          api as unknown as Parameters<typeof useAgendaImportHistory>[2],
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.listImports).toHaveBeenCalledWith(20, undefined, undefined);
  });

  it('passes agendaDate filter when provided', async () => {
    const api = {
      listImports: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };
    const { result } = renderHook(
      () =>
        useAgendaImportHistory(
          '2026-08-25',
          10,
          api as unknown as Parameters<typeof useAgendaImportHistory>[2],
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.listImports).toHaveBeenCalledWith(10, undefined, '2026-08-25');
  });
});

describe('useAgendaImportIncidents', () => {
  it('does not fetch when not authorized', () => {
    const api = { getImportIncidents: vi.fn() };
    const { result } = renderHook(
      () =>
        useAgendaImportIncidents(
          'imp-001',
          false,
          25,
          api as unknown as Parameters<typeof useAgendaImportIncidents>[3],
        ),
      { wrapper },
    );
    expect(result.current.isFetching).toBe(false);
    expect(api.getImportIncidents).not.toHaveBeenCalled();
  });

  it('fetches when authorized with importacionId', async () => {
    const api = {
      getImportIncidents: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };
    const { result } = renderHook(
      () =>
        useAgendaImportIncidents(
          'imp-001',
          true,
          25,
          api as unknown as Parameters<typeof useAgendaImportIncidents>[3],
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.getImportIncidents).toHaveBeenCalledWith('imp-001', 25, undefined);
  });

  it('does not fetch when importacionId is null even if authorized', () => {
    const api = { getImportIncidents: vi.fn() };
    const { result } = renderHook(
      () =>
        useAgendaImportIncidents(
          null,
          true,
          25,
          api as unknown as Parameters<typeof useAgendaImportIncidents>[3],
        ),
      { wrapper },
    );
    expect(result.current.isFetching).toBe(false);
    expect(api.getImportIncidents).not.toHaveBeenCalled();
  });
});
