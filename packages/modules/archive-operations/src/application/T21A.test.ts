import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { ExpedienteId } from '../domain/value-objects/ExpedienteId.js';
import { GetExpedienteAudit } from './GetExpedienteAudit.js';
import { GetSessionAuthorization } from './GetSessionAuthorization.js';
import { ListUbicaciones } from './ListUbicaciones.js';

const tenant: TenantContext = { tenantId: 't1', slug: 't1', hospitalId: 'h1', databaseName: 'db1', timezone: 'UTC' };
const context = (permissions: readonly ('EXPEDIENT_AUDIT_VIEW' | 'LOCATION_VIEW')[]): RequestContext => ({
  actor: { actorId: 'a1', roles: new Set(['IGNORED']), permissions: new Set(permissions), tenantIds: new Set(['t1']) },
  tenant, requestId: 'r1', correlationId: 'c1', source: 'WEB',
});
// Broader helper for permission tests that need arbitrary permission sets
const contextFull = (permissions: readonly string[]): RequestContext => ({
  actor: { actorId: 'a1', roles: new Set(['IGNORED']), permissions: new Set(permissions), tenantIds: new Set(['t1']) },
  tenant, requestId: 'r1', correlationId: 'c1', source: 'WEB',
});
const id = ExpedienteId.parse('11111111-1111-4111-8111-111111111111');

describe('T-21A Application', () => {
  it('GetExpedienteAudit deniega antes de queries', async () => {
    const repository = { findById: vi.fn(), findByNumero: vi.fn(), save: vi.fn() };
    const query = { findByExpediente: vi.fn() };
    const useCase = new GetExpedienteAudit({ expedienteRepository: repository, auditQuery: query });
    await expect(useCase.execute({ expedienteId: id, pagination: { limit: 10 }, context: context([]) }))
      .rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(repository.findById).not.toHaveBeenCalled();
    expect(query.findByExpediente).not.toHaveBeenCalled();
  });

  it('GetExpedienteAudit distingue not-found y propaga tenant/página sanitizada', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(null), findByNumero: vi.fn(), save: vi.fn() };
    const query = { findByExpediente: vi.fn() };
    const useCase = new GetExpedienteAudit({ expedienteRepository: repository, auditQuery: query });
    const input = { expedienteId: id, pagination: { cursor: 'opaque', limit: 2 }, context: context(['EXPEDIENT_AUDIT_VIEW']) };
    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'EXPEDIENTE_NOT_FOUND' });
    repository.findById.mockResolvedValue({});
    query.findByExpediente.mockResolvedValue({ items: [], nextCursor: null });
    await expect(useCase.execute(input)).resolves.toEqual({ items: [], nextCursor: null });
    const page = { items: [{ auditId: 'a', action: 'X', result: 'success', actorRef: 'r', occurredAt: new Date(), source: 'WEB', requestId: 'q', correlationId: 'c' }], nextCursor: null } as const;
    query.findByExpediente.mockResolvedValue(page);
    await expect(useCase.execute(input)).resolves.toBe(page);
    expect(query.findByExpediente).toHaveBeenCalledWith(id, input.pagination, tenant);
    expect(Object.keys(page.items[0])).toEqual(['auditId', 'action', 'result', 'actorRef', 'occurredAt', 'source', 'requestId', 'correlationId']);
  });

  it('GetSessionAuthorization proyecta sólo actorId y permissions', () => {
    const result = new GetSessionAuthorization().execute({ context: context(['EXPEDIENT_AUDIT_VIEW', 'LOCATION_VIEW']) });
    expect(result).toEqual({ actorId: 'a1', permissions: ['EXPEDIENT_AUDIT_VIEW', 'LOCATION_VIEW'] });
    expect(result).not.toHaveProperty('roles');
    expect(result).not.toHaveProperty('tenantIds');
    expect(result).not.toHaveProperty('capabilities');
  });

  it('ListUbicaciones autoriza antes del query y conserva empty/N y tenant', async () => {
    const query = { findAll: vi.fn().mockResolvedValue([]) };
    const useCase = new ListUbicaciones(query);
    await expect(useCase.execute({ context: context([]) })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(query.findAll).not.toHaveBeenCalled();
    await expect(useCase.execute({ context: context(['LOCATION_VIEW']) })).resolves.toEqual([]);
    query.findAll.mockResolvedValue([{ id: 'u1', codigo: 'A', descripcion: 'Archivo' }]);
    await expect(useCase.execute({ context: context(['LOCATION_VIEW']) })).resolves.toEqual([{ id: 'u1', codigo: 'A', descripcion: 'Archivo' }]);
    expect(query.findAll).toHaveBeenLastCalledWith(tenant);
  });
});

describe('GetSessionAuthorization — agenda permissions', () => {
  it('DEMO full actor incluye AGENDA_VIEW en la proyección de sesión', () => {
    // Simulates the harness `full` actor after the fix: includes all 3 agenda permissions.
    const result = new GetSessionAuthorization().execute({
      context: contextFull([
        'EXPEDIENT_VIEW', 'EXPEDIENT_AUDIT_VIEW', 'LOCATION_VIEW',
        'EXPEDIENT_DISPATCH', 'CUSTODY_ACCEPT', 'LOAN_OPEN',
        'AGENDA_VIEW', 'AGENDA_IMPORT', 'AGENDA_INCIDENT_VIEW',
      ]),
    });
    expect(result.permissions).toContain('AGENDA_VIEW');
    expect(result.permissions).toContain('AGENDA_IMPORT');
    expect(result.permissions).toContain('AGENDA_INCIDENT_VIEW');
  });

  it('actor sin AGENDA_VIEW no recibe esa permission en la sesión', () => {
    // Simulates a restricted actor that only has expediente permissions — no agenda.
    const result = new GetSessionAuthorization().execute({
      context: contextFull(['EXPEDIENT_VIEW', 'LOCATION_VIEW']),
    });
    expect(result.permissions).not.toContain('AGENDA_VIEW');
    expect(result.permissions).not.toContain('AGENDA_IMPORT');
    expect(result.permissions).not.toContain('AGENDA_INCIDENT_VIEW');
  });

  it('actor con solo AGENDA_VIEW recibe únicamente AGENDA_VIEW (sin AGENDA_IMPORT)', () => {
    const result = new GetSessionAuthorization().execute({
      context: contextFull(['AGENDA_VIEW']),
    });
    expect(result.permissions).toContain('AGENDA_VIEW');
    expect(result.permissions).not.toContain('AGENDA_IMPORT');
    expect(result.permissions).not.toContain('AGENDA_INCIDENT_VIEW');
  });

  it('string desconocido no es proyectado (isPermission filtra el unknown)', () => {
    // An IdP could return extra claims — they must not be forwarded to the client.
    const result = new GetSessionAuthorization().execute({
      context: contextFull(['AGENDA_VIEW', 'UNKNOWN_FUTURE_PERMISSION', 'ADMIN_SUPER']),
    });
    expect(result.permissions).toContain('AGENDA_VIEW');
    expect(result.permissions).not.toContain('UNKNOWN_FUTURE_PERMISSION');
    expect(result.permissions).not.toContain('ADMIN_SUPER');
  });

  it('sesión sin ningún permiso retorna permissions vacío (fail-closed)', () => {
    const result = new GetSessionAuthorization().execute({
      context: contextFull([]),
    });
    expect(result.permissions).toEqual([]);
  });
});

describe('T-21A Application', () => {
  it('GetExpedienteAudit deniega antes de queries', async () => {
    const repository = { findById: vi.fn(), findByNumero: vi.fn(), save: vi.fn() };
    const query = { findByExpediente: vi.fn() };
    const useCase = new GetExpedienteAudit({ expedienteRepository: repository, auditQuery: query });
    await expect(useCase.execute({ expedienteId: id, pagination: { limit: 10 }, context: context([]) }))
      .rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(repository.findById).not.toHaveBeenCalled();
    expect(query.findByExpediente).not.toHaveBeenCalled();
  });

  it('GetExpedienteAudit distingue not-found y propaga tenant/página sanitizada', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(null), findByNumero: vi.fn(), save: vi.fn() };
    const query = { findByExpediente: vi.fn() };
    const useCase = new GetExpedienteAudit({ expedienteRepository: repository, auditQuery: query });
    const input = { expedienteId: id, pagination: { cursor: 'opaque', limit: 2 }, context: context(['EXPEDIENT_AUDIT_VIEW']) };
    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'EXPEDIENTE_NOT_FOUND' });
    repository.findById.mockResolvedValue({});
    query.findByExpediente.mockResolvedValue({ items: [], nextCursor: null });
    await expect(useCase.execute(input)).resolves.toEqual({ items: [], nextCursor: null });
    const page = { items: [{ auditId: 'a', action: 'X', result: 'success', actorRef: 'r', occurredAt: new Date(), source: 'WEB', requestId: 'q', correlationId: 'c' }], nextCursor: null } as const;
    query.findByExpediente.mockResolvedValue(page);
    await expect(useCase.execute(input)).resolves.toBe(page);
    expect(query.findByExpediente).toHaveBeenCalledWith(id, input.pagination, tenant);
    expect(Object.keys(page.items[0])).toEqual(['auditId', 'action', 'result', 'actorRef', 'occurredAt', 'source', 'requestId', 'correlationId']);
  });

  it('GetSessionAuthorization proyecta sólo actorId y permissions', () => {
    const result = new GetSessionAuthorization().execute({ context: context(['EXPEDIENT_AUDIT_VIEW', 'LOCATION_VIEW']) });
    expect(result).toEqual({ actorId: 'a1', permissions: ['EXPEDIENT_AUDIT_VIEW', 'LOCATION_VIEW'] });
    expect(result).not.toHaveProperty('roles');
    expect(result).not.toHaveProperty('tenantIds');
    expect(result).not.toHaveProperty('capabilities');
  });

  it('ListUbicaciones autoriza antes del query y conserva empty/N y tenant', async () => {
    const query = { findAll: vi.fn().mockResolvedValue([]) };
    const useCase = new ListUbicaciones(query);
    await expect(useCase.execute({ context: context([]) })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(query.findAll).not.toHaveBeenCalled();
    await expect(useCase.execute({ context: context(['LOCATION_VIEW']) })).resolves.toEqual([]);
    query.findAll.mockResolvedValue([{ id: 'u1', codigo: 'A', descripcion: 'Archivo' }]);
    await expect(useCase.execute({ context: context(['LOCATION_VIEW']) })).resolves.toEqual([{ id: 'u1', codigo: 'A', descripcion: 'Archivo' }]);
    expect(query.findAll).toHaveBeenLastCalledWith(tenant);
  });
});
