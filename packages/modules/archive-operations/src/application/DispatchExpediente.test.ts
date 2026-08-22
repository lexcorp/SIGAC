import type { ActorContext, RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it } from 'vitest';
import { Expediente, type ExpedienteSnapshot } from '../domain/Expediente.js';
import type { ExpedienteRepository } from '../domain/ports/ExpedienteRepository.js';
import { Custodia, ExpedienteId, ExpedienteNumero, Ubicacion } from '../domain/value-objects/index.js';
import type {
  ArchiveOperationsTransaction,
  ArchiveOperationsUnitOfWork,
} from './ArchiveOperationsUnitOfWork.js';
import type { AuditEntry, AuditWriter } from '@sigac/audit';
import { DispatchExpediente, type DispatchExpedienteInput } from './DispatchExpediente.js';
import type {
  MovimientoExpedienteAppend,
  MovimientoExpedienteWriter,
} from './MovimientoExpedienteWriter.js';

const tenant: TenantContext = {
  tenantId: 'tenant-a',
  slug: 'hospital-a',
  hospitalId: 'hospital-a',
  databaseName: 'sigac_tenant_a',
  timezone: 'America/Mexico_City',
};

function requestContext(permissions: readonly string[] = ['EXPEDIENT_DISPATCH']): RequestContext {
  const actor: ActorContext = {
    actorId: 'actor-archivo-1',
    roles: new Set(['ARCHIVISTA']),
    permissions: new Set(permissions),
    tenantIds: new Set([tenant.tenantId]),
  };
  return {
    actor,
    tenant,
    requestId: 'request-1',
    correlationId: 'correlation-1',
    source: 'WEB',
  };
}

function expedienteSnapshot(overrides: Partial<ExpedienteSnapshot> = {}): ExpedienteSnapshot {
  return {
    id: ExpedienteId.parse('9b2d3958-f383-4c53-9041-09172fdd408f'),
    expedienteNumero: ExpedienteNumero.parse('PERR810604/10'),
    pacienteReferencia: {
      idInstitucional: 'paciente-sintetico-1',
      curp: 'CURP-SINTETICA',
      nombreOperativo: 'Paciente Sintético',
      numeroIssste: 'ISSSTE-SINTETICO',
    },
    hospitalId: tenant.hospitalId,
    estadoOperativo: 'APARTADO',
    ubicacionActual: Ubicacion.create({
      id: 'ubicacion-origen',
      codigo: 'A-01',
      descripcion: 'Anaquel 1',
    }),
    custodiaActual: Custodia.from({
      custodianType: 'ARCHIVO',
      custodianReference: 'archivo-1',
      service: null,
      location: 'ubicacion-origen',
      acceptedAt: null,
    }),
    rowVersion: 4n,
    ...overrides,
  };
}

interface AuditCall {
  readonly entry: AuditEntry;
  readonly context: RequestContext;
}

class FakeUnitOfWork implements ArchiveOperationsUnitOfWork {
  readonly operationOccurredAt = new Date('2026-08-15T18:30:00.000Z');
  readonly movements: MovimientoExpedienteAppend[] = [];
  readonly transactionAudits: AuditCall[] = [];
  readonly contexts: RequestContext[] = [];
  readonly repositoryTenants: TenantContext[] = [];
  readonly movementTenants: TenantContext[] = [];
  savedSnapshot: Readonly<ExpedienteSnapshot> | null = null;

  constructor(private current: ExpedienteSnapshot | null) {}

  async execute<T>(
    context: RequestContext,
    work: (transaction: ArchiveOperationsTransaction) => Promise<T>,
  ): Promise<T> {
    this.contexts.push(context);
    let stagedSnapshot: Readonly<ExpedienteSnapshot> | null = null;
    const stagedMovements: MovimientoExpedienteAppend[] = [];
    const stagedAudits: AuditCall[] = [];

    const expedienteRepository: ExpedienteRepository = {
      findById: async (_id, resolvedTenant) => {
        this.repositoryTenants.push(resolvedTenant);
        return this.current === null ? null : Expediente.rehydrate(this.current);
      },
      findByNumero: async () => [],
      save: async (expediente, resolvedTenant) => {
        this.repositoryTenants.push(resolvedTenant);
        stagedSnapshot = expediente.snapshot();
      },
    };
    const movimientoWriter: MovimientoExpedienteWriter = {
      append: async (movimiento, resolvedTenant) => {
        this.movementTenants.push(resolvedTenant);
        stagedMovements.push(movimiento);
      },
    };
    const auditWriter: AuditWriter = {
      append: async (entry, auditContext) => {
        stagedAudits.push({ entry, context: auditContext });
      },
    };

    const result = await work({
      expedienteRepository,
      movimientoWriter,
      auditWriter,
      operationOccurredAt: this.operationOccurredAt,
    });

    this.savedSnapshot = stagedSnapshot;
    if (stagedSnapshot) this.current = stagedSnapshot as ExpedienteSnapshot;
    this.movements.push(...stagedMovements);
    this.transactionAudits.push(...stagedAudits);
    return result;
  }
}

function input(overrides: Partial<DispatchExpedienteInput> = {}): DispatchExpedienteInput {
  return {
    expedienteId: ExpedienteId.parse('9b2d3958-f383-4c53-9041-09172fdd408f'),
    destination: Ubicacion.create({
      id: 'ubicacion-destino',
      codigo: 'C-10',
      descripcion: 'Consultorio 10',
    }),
    intendedCustodian: { type: 'RECEPTOR', reference: 'receptor-10' },
    businessReference: { type: 'SOLICITUD', id: 'solicitud-10' },
    expectedRowVersion: 4n,
    context: requestContext(),
    ...overrides,
  };
}

function setup(current: ExpedienteSnapshot | null = expedienteSnapshot()) {
  const unitOfWork = new FakeUnitOfWork(current);
  const outsideAudits: AuditCall[] = [];
  const auditWriter: AuditWriter = {
    append: async (entry, context) => {
      outsideAudits.push({ entry, context });
    },
  };
  return {
    unitOfWork,
    outsideAudits,
    useCase: new DispatchExpediente({ unitOfWork, auditWriter }),
  };
}

describe('DispatchExpediente', () => {
  it('despacha APARTADO dentro de una UoW atómica con evento, movimiento y audit success', async () => {
    const { useCase, unitOfWork, outsideAudits } = setup();
    const command = input();

    const event = await useCase.execute(command);

    expect(unitOfWork.savedSnapshot).toMatchObject({
      estadoOperativo: 'EN_TRASLADO',
      ubicacionActual: command.destination,
      rowVersion: 5n,
    });
    expect(unitOfWork.savedSnapshot?.custodiaActual).toMatchObject({
      custodianType: 'RECEPTOR',
      custodianReference: 'receptor-10',
      service: null,
      location: null,
    });
    expect(unitOfWork.savedSnapshot?.custodiaActual?.acceptedAt).toBeNull();
    expect(event.payload).toEqual({
      expedienteId: command.expedienteId,
      originLocation: expect.objectContaining({ id: 'ubicacion-origen' }),
      destinationLocation: command.destination,
      originCustodianRef: 'archivo-1',
      intendedCustodian: { type: 'RECEPTOR', reference: 'receptor-10' },
      businessReferenceType: 'SOLICITUD',
      businessReferenceId: 'solicitud-10',
    });
    expect(event.occurredAt).toBe(unitOfWork.operationOccurredAt);
    expect(unitOfWork.movements).toEqual([
      {
        expedienteId: command.expedienteId,
        movementType: 'DISPATCHED',
        originLocation: 'ubicacion-origen',
        destinationLocation: 'ubicacion-destino',
        originCustodianRef: 'archivo-1',
        destinationCustodianRef: 'receptor-10',
        businessReferenceType: 'SOLICITUD',
        businessReferenceId: 'solicitud-10',
        occurredAt: unitOfWork.operationOccurredAt,
        actorRef: 'actor-archivo-1',
        source: 'WEB',
        correlationId: 'correlation-1',
      },
    ]);
    expect(unitOfWork.movements[0]?.occurredAt).toBe(unitOfWork.operationOccurredAt);
    expect(unitOfWork.movements[0]).not.toHaveProperty('destinationCustodianType');
    expect(unitOfWork.transactionAudits).toEqual([
      {
        entry: {
          action: 'EXPEDIENTE_DISPATCH',
          resourceType: 'EXPEDIENTE',
          resourceId: command.expedienteId.toString(),
          result: 'success',
        },
        context: command.context,
      },
    ]);
    expect(outsideAudits).toEqual([]);
    expect(unitOfWork.contexts).toEqual([command.context]);
    expect(unitOfWork.repositoryTenants).toEqual([tenant, tenant]);
    expect(unitOfWork.movementTenants).toEqual([tenant]);
  });

  it('audita denied fuera de UoW cuando falta permission', async () => {
    const { useCase, unitOfWork, outsideAudits } = setup();
    const command = input({ context: requestContext([]) });

    await expect(useCase.execute(command)).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });

    expect(unitOfWork.contexts).toEqual([]);
    expect(outsideAudits).toEqual([
      { entry: expect.objectContaining({ result: 'denied' }), context: command.context },
    ]);
  });

  it('audita not-found sin revelar otros tenants ni persistir', async () => {
    const { useCase, unitOfWork, outsideAudits } = setup(null);
    const command = input();

    await expect(useCase.execute(command)).rejects.toMatchObject({
      code: 'EXPEDIENTE_NOT_FOUND',
    });

    expect(unitOfWork.savedSnapshot).toBeNull();
    expect(unitOfWork.movements).toEqual([]);
    expect(unitOfWork.transactionAudits).toEqual([]);
    expect(outsideAudits).toEqual([
      { entry: expect.objectContaining({ result: 'not-found' }), context: command.context },
    ]);
    expect(unitOfWork.repositoryTenants).toEqual([tenant]);
  });

  it('revierte y audita invalid-transition fuera de UoW', async () => {
    const { useCase, unitOfWork, outsideAudits } = setup(
      expedienteSnapshot({ estadoOperativo: 'DISPONIBLE' }),
    );
    const command = input();

    await expect(useCase.execute(command)).rejects.toMatchObject({
      code: 'REQUEST_INVALID_TRANSITION',
    });

    expect(unitOfWork.savedSnapshot).toBeNull();
    expect(unitOfWork.movements).toEqual([]);
    expect(unitOfWork.transactionAudits).toEqual([]);
    expect(outsideAudits).toEqual([
      {
        entry: expect.objectContaining({ result: 'invalid-transition' }),
        context: command.context,
      },
    ]);
  });

  it('revierte y audita conflict fuera de UoW ante expectedRowVersion distinto', async () => {
    const { useCase, unitOfWork, outsideAudits } = setup();
    const command = input({ expectedRowVersion: 3n });

    await expect(useCase.execute(command)).rejects.toMatchObject({
      code: 'OPTIMISTIC_LOCK_CONFLICT',
    });

    expect(unitOfWork.savedSnapshot).toBeNull();
    expect(unitOfWork.movements).toEqual([]);
    expect(unitOfWork.transactionAudits).toEqual([]);
    expect(outsideAudits).toEqual([
      { entry: expect.objectContaining({ result: 'conflict' }), context: command.context },
    ]);
  });

  it('no mezcla datos C3 ni semánticas de préstamo o CustodyAccepted', async () => {
    const { useCase, unitOfWork } = setup();

    const event = await useCase.execute(input());
    const serialized = JSON.stringify({ event, movement: unitOfWork.movements[0] });

    expect(event.name).toBe('ExpedienteDispatched');
    expect(serialized).not.toContain('diagnostico');
    expect(serialized).not.toContain('prestamo');
    expect(serialized).not.toContain('CustodyAccepted');
    expect(serialized).not.toContain('requestId');
    expect(serialized).not.toContain('recordedAt');
  });
});
