import type { ActorContext, RequestContext, TenantContext } from '@sigac/tenant';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Expediente } from '../domain/Expediente.js';
import type { ExpedienteRepository } from '../domain/ports/ExpedienteRepository.js';
import {
  Custodia,
  ExpedienteId,
  ExpedienteNumero,
  Ubicacion,
} from '../domain/value-objects/index.js';
import type { AuditWriter } from './AuditWriter.js';
import { ExpedienteCapabilityService } from './ExpedienteCapabilityService.js';
import type {
  ActiveLoanQueryPort,
  ActiveRequestQueryPort,
  ExitEnablingSourceQueryPort,
  OpenIncidentsQueryPort,
} from './ExpedienteWorkspaceQueryPorts.js';
import { GetExpediente, type GetExpedienteDependencies } from './GetExpediente.js';

const expedienteId = ExpedienteId.parse('11111111-1111-4111-8111-111111111111');
const tenant: TenantContext = {
  tenantId: 'tenant-a',
  slug: 'hospital-a',
  hospitalId: 'hospital-a',
  databaseName: 'sigac_hospital_a',
  timezone: 'America/Mexico_City',
};

function actor(permissions: readonly string[]): ActorContext {
  return {
    actorId: 'actor-a',
    roles: new Set(['ARCHIVISTA']),
    permissions: new Set(permissions),
    tenantIds: new Set([tenant.tenantId]),
  };
}

function context(permissions: readonly string[] = ['EXPEDIENT_VIEW']): RequestContext {
  return {
    actor: actor(permissions),
    tenant,
    requestId: 'request-1',
    correlationId: 'correlation-1',
    source: 'WEB',
  };
}

const expediente = Expediente.rehydrate({
  id: expedienteId,
  expedienteNumero: ExpedienteNumero.parse('PERR810604/10'),
  pacienteReferencia: {
    idInstitucional: 'patient-ref-1',
    curp: 'SYNTHETIC-CURP',
    nombreOperativo: 'PACIENTE SINTETICO',
    numeroIssste: 'SYNTHETIC-ISSSTE',
  },
  hospitalId: tenant.hospitalId,
  estadoOperativo: 'DISPONIBLE',
  ubicacionActual: Ubicacion.create({
    id: 'location-1',
    codigo: 'A-01',
    descripcion: 'Archivo central',
  }),
  custodiaActual: Custodia.from({
    custodianType: 'ARCHIVO',
    custodianReference: 'archivo-central',
    service: null,
    location: 'A-01',
    acceptedAt: null,
  }),
  rowVersion: 7n,
});

describe('GetExpediente', () => {
  let repository: ExpedienteRepository;
  let activeRequestQuery: ActiveRequestQueryPort;
  let activeLoanQuery: ActiveLoanQueryPort;
  let openIncidentsQuery: OpenIncidentsQueryPort;
  let exitEnablingSourceQuery: ExitEnablingSourceQueryPort;
  let auditWriter: AuditWriter;
  let useCase: GetExpediente;

  beforeEach(() => {
    repository = {
      findById: vi.fn().mockResolvedValue(expediente),
      findByNumero: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    };
    activeRequestQuery = {
      findActiveByExpedienteId: vi.fn().mockResolvedValue(null),
    };
    activeLoanQuery = {
      findActiveByExpedienteId: vi.fn().mockResolvedValue(null),
    };
    openIncidentsQuery = {
      findOpenByExpedienteId: vi.fn().mockResolvedValue([]),
    };
    exitEnablingSourceQuery = {
      findAvailableByExpediente: vi.fn().mockResolvedValue([]),
    };
    auditWriter = { append: vi.fn().mockResolvedValue(undefined) };

    const dependencies: GetExpedienteDependencies = {
      expedienteRepository: repository,
      activeRequestQuery,
      activeLoanQuery,
      openIncidentsQuery,
      exitEnablingSourceQuery,
      capabilityService: new ExpedienteCapabilityService(),
      auditWriter,
    };
    useCase = new GetExpediente(dependencies);
  });

  it('compone el read model completo, calcula capabilities y audita success', async () => {
    const requestContext = context([
      'EXPEDIENT_VIEW',
      'REQUEST_CREATE',
      'SEARCH_START',
      'LOAN_OPEN',
      'INCIDENT_OPEN',
    ]);
    vi.mocked(activeRequestQuery.findActiveByExpedienteId).mockResolvedValue({
      solicitudId: 'request-active',
      tipo: 'CONSULTA',
      origen: 'AGENDA',
      estado: 'Asignada',
      asignadoA: 'archivista-1',
    });
    vi.mocked(activeLoanQuery.findActiveByExpedienteId).mockResolvedValue({
      prestamoId: 'loan-active',
      finalidad: 'CONSULTA',
      custodioRef: 'service-1',
      destinoTipo: 'SERVICIO',
      destinoRef: 'service-1',
      dueAt: new Date('2026-08-16T18:00:00.000Z'),
      fuenteHabilitanteSalida: 'CONSULTA_PROGRAMADA',
      estado: 'Activo',
    });
    vi.mocked(openIncidentsQuery.findOpenByExpedienteId).mockResolvedValue([
      {
        incidenciaId: 'incident-1',
        tipo: 'LOCALIZACION',
        severidad: 'MEDIA',
        estado: 'Abierta',
        resumen: 'Resumen operativo sintético',
        asignadoA: null,
        openedAt: new Date('2026-08-15T10:00:00.000Z'),
      },
    ]);
    vi.mocked(exitEnablingSourceQuery.findAvailableByExpediente).mockResolvedValue([
      { tipo: 'CONSULTA_PROGRAMADA', validada: true },
      { tipo: 'ORDEN_SUPERIOR', validada: true },
    ]);

    const result = await useCase.execute({ expedienteId, context: requestContext });

    expect(result).toMatchObject({
      id: expedienteId.toString(),
      expedienteNumero: 'PERR810604/10',
      estadoOperativo: 'DISPONIBLE',
      rowVersion: 7n,
      solicitudActiva: { solicitudId: 'request-active' },
      prestamoActivo: { prestamoId: 'loan-active' },
      incidenciasAbiertas: [{ incidenciaId: 'incident-1' }],
    });
    expect(result.capabilities).toEqual(['INICIAR_BUSQUEDA', 'REPORTAR_INCIDENCIA']);
    expect(result).not.toHaveProperty('updatedAt');
    expect(auditWriter.append).toHaveBeenCalledWith(
      {
        action: 'EXPEDIENTE_VIEW',
        resourceType: 'EXPEDIENTE',
        resourceId: expedienteId.toString(),
        result: 'success',
      },
      requestContext,
    );
  });

  it('representa ausencias con null y [] y propaga id/tenant a todos los query ports', async () => {
    const requestContext = context();
    const result = await useCase.execute({ expedienteId, context: requestContext });

    expect(result.solicitudActiva).toBeNull();
    expect(result.prestamoActivo).toBeNull();
    expect(result.incidenciasAbiertas).toEqual([]);
    expect(result.capabilities).toEqual([]);
    for (const query of [
      activeRequestQuery.findActiveByExpedienteId,
      activeLoanQuery.findActiveByExpedienteId,
      openIncidentsQuery.findOpenByExpedienteId,
      exitEnablingSourceQuery.findAvailableByExpediente,
    ]) {
      expect(query).toHaveBeenCalledWith(expedienteId, tenant);
    }
  });

  it('audita denied y lanza PERMISSION_DENIED sin consultar datos', async () => {
    const requestContext = context([]);
    const execution = useCase.execute({ expedienteId, context: requestContext });

    await expect(execution).rejects.toMatchObject({
      name: 'ApplicationError',
      code: 'PERMISSION_DENIED',
    });
    expect(repository.findById).not.toHaveBeenCalled();
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'denied' }),
      requestContext,
    );
  });

  it('audita not-found y no consulta proyecciones cuando el tenant no encuentra el expediente', async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);
    const requestContext = context();
    const execution = useCase.execute({ expedienteId, context: requestContext });

    await expect(execution).rejects.toMatchObject({
      name: 'ApplicationError',
      code: 'EXPEDIENTE_NOT_FOUND',
    });
    expect(repository.findById).toHaveBeenCalledWith(expedienteId, tenant);
    expect(activeRequestQuery.findActiveByExpedienteId).not.toHaveBeenCalled();
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'not-found' }),
      requestContext,
    );
  });

  it('pasa 0..N fuentes exclusivamente desde ExitEnablingSourceQueryPort a capabilities', async () => {
    const requestContext = context(['EXPEDIENT_VIEW', 'LOAN_OPEN']);
    vi.mocked(exitEnablingSourceQuery.findAvailableByExpediente).mockResolvedValue([
      { tipo: 'ORDEN_SUPERIOR', validada: true },
      { tipo: 'VALE_ARCHIVO_SM_1_14', validada: true },
    ]);

    const result = await useCase.execute({ expedienteId, context: requestContext });

    expect(result.capabilities).toContain('ABRIR_PRESTAMO');
    expect(result.solicitudActiva).toBeNull();
    expect(result.prestamoActivo).toBeNull();
  });

  it('AuditEntry no incorpora contexto técnico ni datos C3', async () => {
    await useCase.execute({ expedienteId, context: context() });
    const [entry] = vi.mocked(auditWriter.append).mock.calls[0] ?? [];

    expect(entry).toEqual({
      action: 'EXPEDIENTE_VIEW',
      resourceType: 'EXPEDIENTE',
      resourceId: expedienteId.toString(),
      result: 'success',
    });
    expect(entry).not.toHaveProperty('occurredAt');
    expect(entry).not.toHaveProperty('requestId');
    expect(entry).not.toHaveProperty('actorRef');
    expect(entry).not.toHaveProperty('tenant');
    expect(entry).not.toHaveProperty('metadata');
  });
});
