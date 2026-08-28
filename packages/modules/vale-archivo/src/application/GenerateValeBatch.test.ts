import { describe, expect, it, vi } from 'vitest';
import type { AuditEntry, AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { ValeArchivo } from '../domain/aggregates/ValeArchivo.js';
import { GenerateValeBatch, type GenerateValeBatchCommand } from './use-cases/GenerateValeBatch.js';
import type {
  ExistingGeneratedVale,
  ValeBatchIdempotencyKey,
  ValeBatchTraceSnapshot,
  ValeBatchTransaction,
  ValeBatchUnitOfWork,
} from './ports/ValeBatchUnitOfWork.js';

function context(
  tenantId: string,
  permissions: readonly string[] = ['REQUEST_CREATE'],
): RequestContext {
  return {
    actor: {
      actorId: 'actor-batch',
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(permissions),
      tenantIds: new Set([tenantId]),
    },
    tenant: {
      tenantId,
      slug: tenantId,
      hospitalId: `hospital-${tenantId}`,
      databaseName: `db_${tenantId}`,
      timezone: 'America/Mexico_City',
    },
    requestId: `request-${tenantId}`,
    correlationId: `correlation-${tenantId}`,
    source: 'INTERNAL',
  };
}

function command(
  groups = 1,
  requestContext = context('tenant-a'),
): GenerateValeBatchCommand {
  return {
    source: {
      kind: 'AGENDA_PREPARATION',
      agendaDate: '2026-08-29',
      sourceImportacionId: 'importacion-1',
      sourceVersion: 'a'.repeat(64),
      generationSnapshotHash: 'b'.repeat(64),
    },
    header: {
      fechaSolicitud: '2026-08-29',
      fechaRecepcion: '2026-08-29',
      unidadSolicitante: 'ARCHIVO CLINICO',
      solicitanteNombre: 'SOLICITANTE PRUEBA',
      solicitanteCargo: 'MEDICO',
      autorizadorNombre: 'AUTORIZADOR PRUEBA',
      autorizadorCargo: 'DIRECTOR',
    },
    groups: Array.from({ length: groups }, (_, index) => ({
      agendaDate: '2026-08-29',
      servicioCodigo: `SERV-${index + 1}`,
      servicioNombre: `SERVICIO ${index + 1}`,
      medicoNumeroEmpleado: `EMP-${index + 1}`,
      medicoNombre: `MEDICO ${index + 1}`,
      items: [{
        expedienteNumero: `EXP-${index + 1}`,
        pacienteNombre: `PACIENTE ${index + 1}`,
        appointmentReferences: [{
          folio: `FOLIO-${index + 1}`,
          servicioCodigo: `SERV-${index + 1}`,
          medicoNumeroEmpleado: `EMP-${index + 1}`,
        }],
      }],
    })),
    resolvedConflicts: [],
    context: requestContext,
  };
}

function commandWithResolvedConflict(groups = 2): GenerateValeBatchCommand {
  const base = command(groups);
  return {
    ...base,
    resolvedConflicts: [{
      expedienteNumero: 'EXP-1',
      ownerGroup: {
        agendaDate: '2026-08-29',
        servicioCodigo: 'SERV-1',
        medicoNumeroEmpleado: 'EMP-1',
      },
      alternatives: [{
        group: {
          agendaDate: '2026-08-29',
          servicioCodigo: 'SERV-1',
          medicoNumeroEmpleado: 'EMP-1',
        },
        appointmentReferences: [{
          folio: 'FOLIO-1',
          servicioCodigo: 'SERV-1',
          medicoNumeroEmpleado: 'EMP-1',
        }],
      }, {
        group: {
          agendaDate: '2026-08-29',
          servicioCodigo: 'SERV-2',
          medicoNumeroEmpleado: 'EMP-2',
        },
        appointmentReferences: [{
          folio: 'FOLIO-EXCLUDED',
          servicioCodigo: 'SERV-2',
          medicoNumeroEmpleado: 'EMP-2',
        }],
      }],
    }],
  };
}

class FakeValeBatchUnitOfWork implements ValeBatchUnitOfWork {
  readonly contexts: RequestContext[] = [];
  readonly committedVales: ValeArchivo[] = [];
  readonly committedTraces: ValeBatchTraceSnapshot[] = [];
  readonly committedAudits: AuditEntry[] = [];
  readonly operationOccurredAt = new Date('2026-08-28T18:00:00.000Z');
  replay: readonly ExistingGeneratedVale[] = [];
  failOnSaveNumber: number | null = null;
  private sequenceByTenant = new Map<string, number>();

  async execute<T>(
    requestContext: RequestContext,
    work: (transaction: ValeBatchTransaction) => Promise<T>,
  ): Promise<T> {
    this.contexts.push(requestContext);
    const stagedVales: ValeArchivo[] = [];
    const stagedTraces: ValeBatchTraceSnapshot[] = [];
    const stagedAudits: AuditEntry[] = [];
    let saveCount = 0;
    let nextSequence = this.sequenceByTenant.get(requestContext.tenant.tenantId) ?? 0;
    const auditWriter: AuditWriter = {
      append: async (entry) => { stagedAudits.push(entry); },
    };
    const transaction: ValeBatchTransaction = {
      operationOccurredAt: this.operationOccurredAt,
      auditWriter,
      findBySource: async (_key: ValeBatchIdempotencyKey) => this.replay,
      reserveDailySequence: async () => { nextSequence += 1; return nextSequence; },
      saveVale: async (vale) => {
        saveCount += 1;
        if (saveCount === this.failOnSaveNumber) throw new Error('simulated persistence failure');
        stagedVales.push(vale);
      },
      appendTraceSnapshot: async (snapshot) => { stagedTraces.push(snapshot); },
    };

    const result = await work(transaction);
    this.sequenceByTenant.set(requestContext.tenant.tenantId, nextSequence);
    this.committedVales.push(...stagedVales);
    this.committedTraces.push(...stagedTraces);
    this.committedAudits.push(...stagedAudits);
    return result;
  }
}

function setup(unitOfWork = new FakeValeBatchUnitOfWork()) {
  const standaloneAuditWriter: AuditWriter = { append: vi.fn().mockResolvedValue(undefined) };
  return {
    unitOfWork,
    standaloneAuditWriter,
    useCase: new GenerateValeBatch({ unitOfWork, auditWriter: standaloneAuditWriter }),
  };
}

describe('GenerateValeBatch — T-02B', () => {
  it('generates one Vale, its items, immutable trace snapshot and transactional audit', async () => {
    const { useCase, unitOfWork, standaloneAuditWriter } = setup();

    const result = await useCase.execute(command());

    expect(result.generatedVales).toHaveLength(1);
    expect(result.generatedVales[0]).toMatchObject({
      numeroVale: 'VA-20260829-001',
      agendaDate: '2026-08-29',
      servicioCodigo: 'SERV-1',
      medicoNumeroEmpleado: 'EMP-1',
      outcome: 'GENERATED',
    });
    expect(unitOfWork.committedVales[0]!.snapshot()).toMatchObject({
      numeroVale: 'VA-20260829-001',
      creadoPor: 'actor-batch',
      createdAt: unitOfWork.operationOccurredAt,
      items: [{ expedienteNumero: 'EXP-1', especialidad: 'SERVICIO 1' }],
    });
    expect(unitOfWork.committedTraces[0]).toMatchObject({
      source: command().source,
      generatedAt: unitOfWork.operationOccurredAt,
      numeroVale: 'VA-20260829-001',
      items: [{
        expedienteNumero: 'EXP-1',
        appointmentReferences: [{ folio: 'FOLIO-1' }],
      }],
    });
    expect(unitOfWork.committedAudits).toEqual([{
      action: 'VALES_DESDE_AGENDA_GENERADOS',
      resourceType: 'AGENDA',
      resourceId: '2026-08-29',
      result: 'success',
      changeSummary: { generatedValeCount: '1' },
    }]);
    expect(standaloneAuditWriter.append).not.toHaveBeenCalled();
  });

  it('generates multiple Vales with consecutive server-side numbers', async () => {
    const { useCase, unitOfWork } = setup();

    const result = await useCase.execute(command(3));

    expect(result.generatedVales.map((vale) => vale.numeroVale)).toEqual([
      'VA-20260829-001',
      'VA-20260829-002',
      'VA-20260829-003',
    ]);
    expect(unitOfWork.committedVales).toHaveLength(3);
    expect(unitOfWork.committedTraces).toHaveLength(3);
  });

  it('associates resolved conflict evidence and excluded references to the owner ValeItem only', async () => {
    const { useCase, unitOfWork } = setup();

    await useCase.execute(commandWithResolvedConflict());

    const ownerTrace = unitOfWork.committedTraces.find(
      (trace) => trace.servicioCodigo === 'SERV-1',
    )!;
    const alternativeTrace = unitOfWork.committedTraces.find(
      (trace) => trace.servicioCodigo === 'SERV-2',
    )!;
    expect(ownerTrace.resolvedConflicts).toHaveLength(1);
    expect(ownerTrace.resolvedConflicts[0]).toMatchObject({
      expedienteNumero: 'EXP-1',
      ownerValeItemId: ownerTrace.items[0]!.valeItemId,
      alternatives: [{
        appointmentReferences: [{ folio: 'FOLIO-1' }],
      }, {
        appointmentReferences: [{ folio: 'FOLIO-EXCLUDED' }],
      }],
    });
    expect(alternativeTrace.resolvedConflicts).toEqual([]);
    expect(unitOfWork.committedVales[1]!.snapshot().items)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ expedienteNumero: 'EXP-1' })]));
  });

  it('returns an empty result without opening a transaction for an empty batch', async () => {
    const { useCase, unitOfWork } = setup();

    await expect(useCase.execute(command(0))).resolves.toEqual({ generatedVales: [] });
    expect(unitOfWork.contexts).toHaveLength(0);
  });

  it('returns ALREADY_GENERATED on identical replay without creating state', async () => {
    const unitOfWork = new FakeValeBatchUnitOfWork();
    unitOfWork.replay = [{
      valeId: 'vale-existing',
      numeroVale: 'VA-20260829-007',
      agendaDate: '2026-08-29',
      servicioCodigo: 'SERV-1',
      medicoNumeroEmpleado: 'EMP-1',
    }];
    const { useCase } = setup(unitOfWork);

    await expect(useCase.execute(commandWithResolvedConflict())).resolves.toEqual({
      generatedVales: [{ ...unitOfWork.replay[0], outcome: 'ALREADY_GENERATED' }],
    });
    expect(unitOfWork.committedVales).toHaveLength(0);
    expect(unitOfWork.committedTraces).toHaveLength(0);
    expect(unitOfWork.committedAudits).toHaveLength(0);
  });

  it('propagates the server-resolved tenant and isolates daily sequences by tenant', async () => {
    const unitOfWork = new FakeValeBatchUnitOfWork();
    const { useCase } = setup(unitOfWork);

    const tenantA = await useCase.execute(command(1, context('tenant-a')));
    const tenantB = await useCase.execute(command(1, context('tenant-b')));

    expect(unitOfWork.contexts.map(({ tenant }) => tenant.tenantId)).toEqual(['tenant-a', 'tenant-b']);
    expect(tenantA.generatedVales[0]!.numeroVale).toBe('VA-20260829-001');
    expect(tenantB.generatedVales[0]!.numeroVale).toBe('VA-20260829-001');
  });

  it('rolls back all Vales, trace snapshots and success audit when any write fails', async () => {
    const unitOfWork = new FakeValeBatchUnitOfWork();
    unitOfWork.failOnSaveNumber = 2;
    const { useCase } = setup(unitOfWork);

    await expect(useCase.execute(commandWithResolvedConflict())).rejects.toThrow('simulated persistence failure');
    expect(unitOfWork.committedVales).toHaveLength(0);
    expect(unitOfWork.committedTraces).toHaveLength(0);
    expect(unitOfWork.committedAudits).toHaveLength(0);
  });

  it('denies without opening the mutating UnitOfWork and audits without PII', async () => {
    const { useCase, unitOfWork, standaloneAuditWriter } = setup();
    const denied = command(1, context('tenant-a', []));

    await expect(useCase.execute(denied)).rejects.toMatchObject({
      name: 'ApplicationError',
      code: 'PERMISSION_DENIED',
    });
    expect(unitOfWork.contexts).toHaveLength(0);
    expect(standaloneAuditWriter.append).toHaveBeenCalledWith({
      action: 'VALES_DESDE_AGENDA_GENERADOS',
      resourceType: 'AGENDA',
      resourceId: '2026-08-29',
      result: 'denied',
    }, denied.context);
    expect(JSON.stringify((standaloneAuditWriter.append as ReturnType<typeof vi.fn>).mock.calls))
      .not.toMatch(/PACIENTE|FOLIO|EXP-/);
  });
});
