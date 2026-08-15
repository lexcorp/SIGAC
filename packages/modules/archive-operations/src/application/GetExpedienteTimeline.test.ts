import type { ActorContext, RequestContext, TenantContext } from '@sigac/tenant';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Expediente } from '../domain/Expediente.js';
import type { ExpedienteRepository } from '../domain/ports/ExpedienteRepository.js';
import { ExpedienteId, ExpedienteNumero } from '../domain/value-objects/index.js';
import type { AuditWriter } from './AuditWriter.js';
import type {
  ExpedienteTimelineQueryPort,
  TimelinePage,
  TimelinePagination,
} from './ExpedienteTimelineQueryPort.js';
import {
  GetExpedienteTimeline,
  type GetExpedienteTimelineDependencies,
} from './GetExpedienteTimeline.js';

const expedienteId = ExpedienteId.parse('22222222-2222-4222-8222-222222222222');
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
    requestId: 'request-timeline-1',
    correlationId: 'correlation-timeline-1',
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
  ubicacionActual: null,
  custodiaActual: null,
  rowVersion: 1n,
});

const emptyPage: TimelinePage = { items: [], nextCursor: null };

describe('GetExpedienteTimeline', () => {
  let repository: ExpedienteRepository;
  let timelineQuery: ExpedienteTimelineQueryPort;
  let auditWriter: AuditWriter;
  let useCase: GetExpedienteTimeline;

  beforeEach(() => {
    repository = {
      findById: vi.fn().mockResolvedValue(expediente),
      findByNumero: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    };
    timelineQuery = {
      findByExpediente: vi.fn().mockResolvedValue(emptyPage),
    };
    auditWriter = { append: vi.fn().mockResolvedValue(undefined) };

    const dependencies: GetExpedienteTimelineDependencies = {
      expedienteRepository: repository,
      timelineQuery,
      auditWriter,
    };
    useCase = new GetExpedienteTimeline(dependencies);
  });

  it('autoriza antes de queries y responde PERMISSION_DENIED con audit denied', async () => {
    const requestContext = context([]);
    const execution = useCase.execute({
      expedienteId,
      pagination: { limit: 20 },
      context: requestContext,
    });

    await expect(execution).rejects.toMatchObject({
      name: 'ApplicationError',
      code: 'PERMISSION_DENIED',
    });
    expect(repository.findById).not.toHaveBeenCalled();
    expect(timelineQuery.findByExpediente).not.toHaveBeenCalled();
    expect(auditWriter.append).toHaveBeenCalledWith(
      {
        action: 'EXPEDIENTE_TIMELINE_VIEW',
        resourceType: 'EXPEDIENTE',
        resourceId: expedienteId.toString(),
        result: 'denied',
      },
      requestContext,
    );
  });

  it('responde EXPEDIENTE_NOT_FOUND y no consulta timeline cuando el tenant no encuentra el recurso', async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);
    const requestContext = context();
    const execution = useCase.execute({
      expedienteId,
      pagination: { limit: 20 },
      context: requestContext,
    });

    await expect(execution).rejects.toMatchObject({
      name: 'ApplicationError',
      code: 'EXPEDIENTE_NOT_FOUND',
    });
    expect(repository.findById).toHaveBeenCalledWith(expedienteId, tenant);
    expect(timelineQuery.findByExpediente).not.toHaveBeenCalled();
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'not-found' }),
      requestContext,
    );
  });

  it('trata el timeline vacío como success, sin total ni filas de audit', async () => {
    const requestContext = context();
    const result = await useCase.execute({
      expedienteId,
      pagination: { limit: 20 },
      context: requestContext,
    });

    expect(result).toEqual({ items: [], nextCursor: null });
    expect(result).not.toHaveProperty('total');
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXPEDIENTE_TIMELINE_VIEW',
        resourceType: 'EXPEDIENTE',
        result: 'success',
      }),
      requestContext,
    );
  });

  it('propaga pagination opaca y tenant, preservando el orden y nextCursor del port', async () => {
    const pagination: TimelinePagination = { cursor: 'opaque-cursor', limit: 2 };
    const page: TimelinePage = {
      items: [
        {
          movimientoId: 'movement-2',
          movementType: 'CUSTODY_ACCEPTED',
          originLocation: 'location-1',
          destinationLocation: 'location-2',
          originCustodianRef: 'archivo',
          destinationCustodianRef: 'service-1',
          businessReferenceType: 'SOLICITUD',
          businessReferenceId: 'request-1',
          occurredAt: new Date('2026-08-15T12:00:00.000Z'),
          recordedAt: new Date('2026-08-15T12:00:01.000Z'),
          actorRef: 'actor-a',
          source: 'WEB',
          correlationId: 'correlation-1',
        },
        {
          movimientoId: 'movement-1',
          movementType: 'DISPATCHED',
          originLocation: 'location-0',
          destinationLocation: 'location-1',
          originCustodianRef: 'archivo',
          destinationCustodianRef: 'transport-1',
          businessReferenceType: 'SOLICITUD',
          businessReferenceId: 'request-1',
          occurredAt: new Date('2026-08-15T11:00:00.000Z'),
          recordedAt: new Date('2026-08-15T11:00:01.000Z'),
          actorRef: 'actor-a',
          source: 'WEB',
          correlationId: 'correlation-1',
        },
      ],
      nextCursor: 'next-opaque-cursor',
    };
    vi.mocked(timelineQuery.findByExpediente).mockResolvedValue(page);
    const requestContext = context();

    const result = await useCase.execute({ expedienteId, pagination, context: requestContext });

    expect(repository.findById).toHaveBeenCalledWith(expedienteId, tenant);
    expect(timelineQuery.findByExpediente).toHaveBeenCalledWith(
      expedienteId,
      pagination,
      tenant,
    );
    expect(result).toBe(page);
    expect(result.items.map(({ movimientoId }) => movimientoId)).toEqual([
      'movement-2',
      'movement-1',
    ]);
    expect(result.nextCursor).toBe('next-opaque-cursor');
    expect(result.items.every((item) => !('auditId' in item))).toBe(true);
  });

  it('AuditEntry no añade datos clínicos ni contexto técnico y no crea movimientos', async () => {
    await useCase.execute({
      expedienteId,
      pagination: { limit: 20 },
      context: context(),
    });
    const [entry] = vi.mocked(auditWriter.append).mock.calls[0] ?? [];

    expect(entry).toEqual({
      action: 'EXPEDIENTE_TIMELINE_VIEW',
      resourceType: 'EXPEDIENTE',
      resourceId: expedienteId.toString(),
      result: 'success',
    });
    expect(entry).not.toHaveProperty('patient');
    expect(entry).not.toHaveProperty('occurredAt');
    expect(entry).not.toHaveProperty('requestId');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
