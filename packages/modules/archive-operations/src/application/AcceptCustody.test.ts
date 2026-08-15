import type { ActorContext, RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it } from 'vitest';
import { Expediente, type ExpedienteSnapshot } from '../domain/Expediente.js';
import type { ExpedienteRepository } from '../domain/ports/ExpedienteRepository.js';
import { Custodia, ExpedienteId, ExpedienteNumero, Ubicacion } from '../domain/value-objects/index.js';
import { AcceptCustody, type AcceptCustodyInput } from './AcceptCustody.js';
import type {
  ArchiveOperationsTransaction,
  ArchiveOperationsUnitOfWork,
} from './ArchiveOperationsUnitOfWork.js';
import type { AuditEntry, AuditWriter } from './AuditWriter.js';
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

function requestContext(permissions: readonly string[] = ['CUSTODY_ACCEPT']): RequestContext {
  const actor: ActorContext = {
    actorId: 'receptor-efectivo-1',
    roles: new Set(['RECEPTOR_SERVICIO']),
    permissions: new Set(permissions),
    tenantIds: new Set([tenant.tenantId]),
  };
  return {
    actor,
    tenant,
    requestId: 'request-accept-1',
    correlationId: 'correlation-transfer-1',
    source: 'WEB',
  };
}

function expedienteSnapshot(overrides: Partial<ExpedienteSnapshot> = {}): ExpedienteSnapshot {
  const destination = Ubicacion.create({
    id: 'ubicacion-destino',
    codigo: 'C-10',
    descripcion: 'Consultorio 10',
  });
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
    estadoOperativo: 'EN_TRASLADO',
    ubicacionActual: destination,
    custodiaActual: Custodia.enTraslado({
      custodianType: 'RECEPTOR_PREVISTO',
      custodianReference: 'previsto-10',
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

  constructor(
    private current: ExpedienteSnapshot | null,
    private readonly failMovement = false,
  ) {}

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
        if (this.failMovement) throw new Error('movement append failed');
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

function input(overrides: Partial<AcceptCustodyInput> = {}): AcceptCustodyInput {
  return {
    expedienteId: ExpedienteId.parse('9b2d3958-f383-4c53-9041-09172fdd408f'),
    receptor: {
      type: 'RECEPTOR_EFECTIVO',
      reference: 'receptor-efectivo-1',
      service: 'Consulta externa',
    },
    ubicacionDestino: Ubicacion.create({
      id: 'ubicacion-destino',
      codigo: 'C-10',
      descripcion: 'Consultorio 10',
    }),
    businessReference: { type: 'SOLICITUD', id: 'solicitud-10' },
    expectedRowVersion: 4n,
    context: requestContext(),
    ...overrides,
  };
}

function setup(
  current: ExpedienteSnapshot | null = expedienteSnapshot(),
  failMovement = false,
) {
  const unitOfWork = new FakeUnitOfWork(current, failMovement);
  const outsideAudits: AuditCall[] = [];
  const auditWriter: AuditWriter = {
    append: async (entry, context) => {
      outsideAudits.push({ entry, context });
    },
  };
  return {
    unitOfWork,
    outsideAudits,
    useCase: new AcceptCustody({ unitOfWork, auditWriter }),
  };
}

describe('AcceptCustody', () => {
  it.each(['Consulta externa', null])(
    'acepta custodia con service %s dentro de una UoW atómica',
    async (service) => {
      const { useCase, unitOfWork, outsideAudits } = setup();
      const command = input({ receptor: { ...input().receptor, service } });

      const event = await useCase.execute(command);

      expect(unitOfWork.savedSnapshot).toMatchObject({
        estadoOperativo: 'EN_CONSULTA',
        ubicacionActual: command.ubicacionDestino,
        rowVersion: 5n,
      });
      expect(unitOfWork.savedSnapshot?.custodiaActual).toMatchObject({
        custodianType: 'RECEPTOR_EFECTIVO',
        custodianReference: 'receptor-efectivo-1',
        service,
        location: 'ubicacion-destino',
      });
      expect(unitOfWork.savedSnapshot?.custodiaActual?.acceptedAt).toEqual(
        unitOfWork.operationOccurredAt,
      );
      expect(event.payload).toEqual({
        expedienteId: command.expedienteId,
        location: command.ubicacionDestino,
        intendedCustodian: { type: 'RECEPTOR_PREVISTO', reference: 'previsto-10' },
        acceptedCustodian: {
          type: 'RECEPTOR_EFECTIVO',
          reference: 'receptor-efectivo-1',
          service,
        },
      });
      expect(event.occurredAt).toBe(unitOfWork.operationOccurredAt);
      expect(unitOfWork.movements).toEqual([
        {
          expedienteId: command.expedienteId,
          movementType: 'CUSTODY_ACCEPTED',
          originLocation: 'ubicacion-destino',
          destinationLocation: 'ubicacion-destino',
          originCustodianRef: 'previsto-10',
          destinationCustodianRef: 'receptor-efectivo-1',
          businessReferenceType: 'SOLICITUD',
          businessReferenceId: 'solicitud-10',
          occurredAt: unitOfWork.operationOccurredAt,
          actorRef: 'receptor-efectivo-1',
          source: 'WEB',
          correlationId: 'correlation-transfer-1',
        },
      ]);
      expect(unitOfWork.movements[0]?.occurredAt).toBe(unitOfWork.operationOccurredAt);
      expect(unitOfWork.movements[0]).not.toHaveProperty('destinationCustodianType');
      expect(unitOfWork.transactionAudits).toEqual([
        {
          entry: {
            action: 'CUSTODY_ACCEPTED',
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
    },
  );

  it('audita denied fuera de UoW cuando falta CUSTODY_ACCEPT', async () => {
    const { useCase, unitOfWork, outsideAudits } = setup();
    const command = input({ context: requestContext([]) });

    await expect(useCase.execute(command)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    expect(unitOfWork.contexts).toEqual([]);
    expect(outsideAudits).toEqual([
      { entry: expect.objectContaining({ result: 'denied' }), context: command.context },
    ]);
  });

  it('audita not-found sin revelar otros tenants ni persistir', async () => {
    const { useCase, unitOfWork, outsideAudits } = setup(null);
    const command = input();

    await expect(useCase.execute(command)).rejects.toMatchObject({ code: 'EXPEDIENTE_NOT_FOUND' });

    expect(unitOfWork.savedSnapshot).toBeNull();
    expect(unitOfWork.movements).toEqual([]);
    expect(unitOfWork.transactionAudits).toEqual([]);
    expect(outsideAudits).toEqual([
      { entry: expect.objectContaining({ result: 'not-found' }), context: command.context },
    ]);
    expect(unitOfWork.repositoryTenants).toEqual([tenant]);
  });

  it.each([
    { state: expedienteSnapshot({ estadoOperativo: 'DISPONIBLE' }), otherLocation: false },
    { state: expedienteSnapshot(), otherLocation: true },
  ])('audita invalid-transition y no persiste ante estado o ubicación incompatible', async ({
    state,
    otherLocation,
  }) => {
    const command = otherLocation
      ? input({
          ubicacionDestino: Ubicacion.create({ id: 'otra', codigo: 'C-11', descripcion: 'C11' }),
        })
      : input();
    const { useCase, unitOfWork, outsideAudits } = setup(state);

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

  it('audita conflict fuera de UoW ante expectedRowVersion distinto', async () => {
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

  it('revierte aggregate, movimiento y audit success si falla un append de la UoW', async () => {
    const { useCase, unitOfWork, outsideAudits } = setup(expedienteSnapshot(), true);

    await expect(useCase.execute(input())).rejects.toThrow('movement append failed');

    expect(unitOfWork.savedSnapshot).toBeNull();
    expect(unitOfWork.movements).toEqual([]);
    expect(unitOfWork.transactionAudits).toEqual([]);
    expect(outsideAudits).toEqual([]);
  });

  it('mantiene separados DomainEvent, Movimiento y Audit sin datos C3', async () => {
    const { useCase, unitOfWork } = setup();

    const event = await useCase.execute(input());
    const serialized = JSON.stringify({ event, movement: unitOfWork.movements[0] });

    expect(event.name).toBe('CustodyAccepted');
    expect(serialized).not.toContain('diagnostico');
    expect(serialized).not.toContain('requestId');
    expect(serialized).not.toContain('recordedAt');
    expect(unitOfWork.movements[0]).not.toEqual(event.payload);
    expect(unitOfWork.transactionAudits[0]?.entry).not.toEqual(unitOfWork.movements[0]);
  });
});
