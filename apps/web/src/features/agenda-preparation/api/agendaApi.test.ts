import { describe, expect, it, vi } from 'vitest';
import { AgendaApi, AgendaApiError } from './agendaApi';
import type { AgendaDayReadModel, AgendaImportResponse } from '../types/agenda.types';

const mockFetcher = vi.fn();

function setup() {
  mockFetcher.mockReset();
  return new AgendaApi(mockFetcher);
}

function okJson(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function errorJson(status: number, code: string) {
  return Promise.resolve(new Response(JSON.stringify({ type: 'test', title: 'err', status, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

const sampleDay: AgendaDayReadModel = {
  agendaDate: '2026-08-25',
  latestImportacionId: 'imp-001',
  latestImportedAt: '2026-08-25T10:00:00Z',
  latestOutcome: 'IMPORTED',
  activeAppointments: 5,
  physicians: 2,
  services: 1,
  incidentCount: 0,
};

describe('AgendaApi', () => {
  it('getAgendaDay returns AgendaDayReadModel', async () => {
    const api = setup();
    mockFetcher.mockReturnValue(okJson(sampleDay));
    const result = await api.getAgendaDay('2026-08-25');
    expect(result).toEqual(sampleDay);
    const url = mockFetcher.mock.calls[0]![0] as string;
    expect(url).toBe('/api/v1/agendas/2026-08-25');
  });

  it('getAgendaDay throws AgendaApiError on 404', async () => {
    const api = setup();
    mockFetcher.mockReturnValue(errorJson(404, 'AGENDA_NOT_FOUND'));
    await expect(api.getAgendaDay('2099-01-01')).rejects.toBeInstanceOf(AgendaApiError);
    mockFetcher.mockReturnValue(errorJson(404, 'AGENDA_NOT_FOUND'));
    const err = await api.getAgendaDay('2099-01-01').catch((e: unknown) => e);
    expect((err as AgendaApiError).status).toBe(404);
    expect((err as AgendaApiError).problem?.code).toBe('AGENDA_NOT_FOUND');
  });

  it('importAgenda sends multipart POST with Idempotency-Key', async () => {
    const api = setup();
    const importResponse: AgendaImportResponse = {
      importacionId: 'imp-001', agendaDate: '2026-08-25',
      importedAt: '2026-08-25T10:00:00Z', outcome: 'IMPORTED',
      metrics: { receivedRecords: 2, processed: 2, added: 2, updated: 0, unchanged: 0,
        restored: 0, pendingReview: 0, rejected: 0, duplicateFolio: 0,
        withdrawnFromAgenda: 0, incidents: 0, errors: 0 },
    };
    mockFetcher.mockReturnValue(new Response(JSON.stringify(importResponse), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    }));
    const file = new File(['<html></html>'], 'agenda.xls', { type: 'application/vnd.ms-excel' });
    const result = await api.importAgenda(file, 'key-001');
    expect(result.outcome).toBe('IMPORTED');
    const [url, init] = mockFetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/agenda-imports');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('key-001');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.method).toBe('POST');
  });

  it('getPreparationList includes order, limit and cursor', async () => {
    const api = setup();
    mockFetcher.mockReturnValue(okJson({ items: [], nextCursor: null }));
    await api.getPreparationList('2026-08-25', 'PATIENT_NAME_ASC', 20, 'cursor-abc');
    const url = mockFetcher.mock.calls[0]![0] as string;
    expect(url).toContain('order=PATIENT_NAME_ASC');
    expect(url).toContain('limit=20');
    expect(url).toContain('cursor=cursor-abc');
  });

  it('listImports without cursor omits cursor param', async () => {
    const api = setup();
    mockFetcher.mockReturnValue(okJson({ items: [], nextCursor: null }));
    await api.listImports(10);
    const url = mockFetcher.mock.calls[0]![0] as string;
    expect(url).not.toContain('cursor=');
    expect(url).toContain('limit=10');
  });
});
