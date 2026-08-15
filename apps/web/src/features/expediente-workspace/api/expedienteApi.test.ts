import { describe, expect, it, vi } from 'vitest';
import { ExpedienteApi, ExpedienteApiError } from './expedienteApi';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ExpedienteApi', () => {
  it('envía el número sin normalizar y conserva respuesta 0..N con items', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const api = new ExpedienteApi(fetcher);
    await expect(api.searchByNumero('PERR810604-10')).resolves.toEqual({ items: [] });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/expedientes?numero=PERR810604-10',
      { headers: { Accept: 'application/json' } },
    );
  });

  it('reenvía el cursor opaco sin decodificar y no solicita total', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ items: [], nextCursor: null }));
    const api = new ExpedienteApi(fetcher);
    await api.getTimeline('exp-1', { limit: 25, cursor: 'opaque.value' });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/expedientes/exp-1/timeline?limit=25&cursor=opaque.value');
  });

  it('Dispatch envía sólo el contrato aprobado y preserva expectedRowVersion string', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const api = new ExpedienteApi(fetcher);
    const body = {
      destination: { id: 'location-1', codigo: 'CONS-1', descripcion: 'Consultorio' },
      intendedCustodian: { type: 'SERVICIO', reference: 'receiver-1' },
      businessReference: { type: 'VALE', id: null },
      expectedRowVersion: '9007199254740993',
    } as const;
    await api.dispatch('exp-1', body);
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual(body);
    expect(init.body).not.toContain('tenant');
    expect(init.body).not.toContain('occurredAt');
  });

  it('AcceptCustody envía sólo el contrato aprobado y preserva expectedRowVersion string', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const api = new ExpedienteApi(fetcher);
    const body = {
      receptor: { type: 'MEDICO', reference: 'receiver-1', service: null },
      ubicacionDestino: { id: 'location-1', codigo: 'CONS-1', descripcion: 'Consultorio' },
      businessReference: { type: 'VALE', id: 'vale-1' },
      expectedRowVersion: '42',
    } as const;
    await api.acceptCustody('exp-1', body);
    expect(JSON.parse((fetcher.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual(body);
  });

  it('consume RFC7807 sin convertir detail técnico en message visible', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      type: 'https://sigac/errors/conflict',
      title: 'Conflict',
      status: 409,
      code: 'OPTIMISTIC_LOCK_CONFLICT',
      detail: 'internal technical detail',
    }, 409));
    const api = new ExpedienteApi(fetcher);
    await expect(api.getById('exp-1')).rejects.toEqual(expect.objectContaining({
      message: 'No fue posible completar la operación.',
      status: 409,
    }));
  });
});
