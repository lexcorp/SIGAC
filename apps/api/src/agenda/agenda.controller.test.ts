import { HttpException } from '@nestjs/common';
import {
  type GetAgendaDaySummary,
  type GetAgendaImportIncidents,
  type GetAgendaImportResult,
  type GetAgendaPreparationList,
  type ImportAgenda,
  type ListAgendaImports,
  type PrintAgendaPreparationList,
  ApplicationError,
  AgendaFecha,
  LayoutRejectedError,
} from '@sigac/agenda-preparation';
import type { RequestContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import {
  AgendaApiProblemMapper,
  AuthenticationRequiredError,
  type ProblemDetails,
} from './agenda-api-errors.js';
import type { AuthenticatedRequestContextResolver } from './agenda-api.contracts.js';
import { AgendaController } from './agenda.controller.js';
import { AgendaApiModule } from './agenda-api.module.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const importacionId = '11111111-2222-4333-8444-555555555555';

const trustedContext: RequestContext = {
  actor: {
    actorId: 'actor-trusted',
    roles: new Set(['ARCHIVISTA']),
    permissions: new Set(['AGENDA_IMPORT', 'AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW']),
    tenantIds: new Set(['tenant-trusted']),
  },
  tenant: {
    tenantId: 'tenant-trusted',
    slug: 'hospital-trusted',
    hospitalId: 'hospital-trusted',
    databaseName: 'sigac_hospital_trusted',
    timezone: 'America/Mexico_City',
  },
  requestId: 'request-trusted',
  correlationId: 'correlation-trusted',
  source: 'WEB',
};

const sampleMetrics = {
  receivedRecords: 3,
  processed: 3,
  added: 3,
  updated: 0,
  unchanged: 0,
  restored: 0,
  pendingReview: 0,
  rejected: 0,
  duplicateFolio: 0,
  withdrawnFromAgenda: 0,
  incidents: 0,
  errors: 0,
};

const sampleImportResult = {
  importacionId,
  agendaDate: '2026-08-25',
  outcome: 'IMPORTED' as const,
  metrics: sampleMetrics,
  hasChanges: true,
};

function makeFile(
  overrides: Partial<{ size: number; originalname: string; buffer: Buffer }> = {},
): { fieldname: string; originalname: string; buffer: Buffer; size: number } {
  return {
    fieldname: 'file',
    originalname: overrides.originalname ?? 'agenda.xls',
    buffer: overrides.buffer ?? Buffer.from('<html></html>'),
    size: overrides.size ?? 100,
  };
}

function setup(
  options: {
    resolve?: AuthenticatedRequestContextResolver['resolve'];
    importResult?: unknown;
    listResult?: unknown;
    getResult?: unknown;
    daySummary?: unknown;
    prepPage?: unknown;
    printItems?: unknown;
    incidents?: unknown;
  } = {},
) {
  const resolver: AuthenticatedRequestContextResolver = {
    resolve: options.resolve ?? vi.fn().mockResolvedValue(trustedContext),
  };

  const importAgenda = {
    execute: vi.fn().mockResolvedValue(options.importResult ?? sampleImportResult),
  };
  const getAgendaImportResult = {
    execute: vi.fn().mockResolvedValue(
      options.getResult ?? {
        summary: { ...sampleImportResult, importedAt: new Date('2026-08-25T10:00:00Z') },
        registros: [],
      },
    ),
  };
  const listAgendaImports = {
    execute: vi.fn().mockResolvedValue(
      options.listResult ?? { items: [], nextCursor: null },
    ),
  };
  const getAgendaDaySummary = {
    execute: vi.fn().mockResolvedValue(
      options.daySummary ?? {
        agendaDate: '2026-08-25',
        latestImportacionId: importacionId,
        latestImportedAt: new Date('2026-08-25T10:00:00Z'),
        latestOutcome: 'IMPORTED',
        activeAppointments: 3,
        physicians: 1,
        services: 1,
        incidentCount: 0,
      },
    ),
  };
  const getAgendaPreparationList = {
    execute: vi.fn().mockResolvedValue(options.prepPage ?? { items: [], nextCursor: null }),
  };
  const printAgendaPreparationList = {
    execute: vi.fn().mockResolvedValue(options.printItems ?? []),
  };
  const getAgendaImportIncidents = {
    execute: vi.fn().mockResolvedValue(options.incidents ?? []),
  };

  const controller = new AgendaController(
    resolver,
    importAgenda as unknown as ImportAgenda,
    getAgendaImportResult as unknown as GetAgendaImportResult,
    listAgendaImports as unknown as ListAgendaImports,
    getAgendaDaySummary as unknown as GetAgendaDaySummary,
    getAgendaPreparationList as unknown as GetAgendaPreparationList,
    printAgendaPreparationList as unknown as PrintAgendaPreparationList,
    getAgendaImportIncidents as unknown as GetAgendaImportIncidents,
    new AgendaApiProblemMapper(),
  );

  return {
    controller,
    resolver,
    importAgenda,
    getAgendaImportResult,
    listAgendaImports,
    getAgendaDaySummary,
    getAgendaPreparationList,
    printAgendaPreparationList,
    getAgendaImportIncidents,
  };
}

async function expectProblem(
  promise: Promise<unknown>,
  status: number,
  code: string,
): Promise<ProblemDetails> {
  try {
    await promise;
    throw new Error('Expected an HttpException.');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const exception = error as HttpException;
    expect(exception.getStatus()).toBe(status);
    const response = exception.getResponse() as ProblemDetails;
    expect(response).toMatchObject({ status, code });
    return response;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgendaController — T-13', () => {

  // -------------------------------------------------------------------------
  // POST /agenda-imports
  // -------------------------------------------------------------------------

  describe('importAgenda (POST /agenda-imports)', () => {
    it('archivo válido devuelve 201 con shape de respuesta aprobada', async () => {
      const { controller } = setup();
      const result = await controller.importAgenda(makeFile(), 'key-001', {}) as Record<string, unknown>;
      expect(result).toMatchObject({
        importacionId: expect.any(String),
        agendaDate: '2026-08-25',
        outcome: 'IMPORTED',
        importedAt: expect.any(String),
      });
      expect(result).toHaveProperty('metrics');
    });

    it('respuesta no expone fingerprint, filename, raw ni curp', async () => {
      const { controller } = setup();
      const result = await controller.importAgenda(makeFile(), 'key-001', {});
      const json = JSON.stringify(result);
      expect(json).not.toMatch(/fingerprint/i);
      expect(json).not.toMatch(/filename/i);
      expect(json).not.toMatch(/curp/i);
      expect(json).not.toMatch(/\braw\b/i);
    });

    it('file ausente retorna 400 HTTP_VALIDATION_ERROR', async () => {
      const { controller } = setup();
      await expectProblem(controller.importAgenda(undefined, 'key-001', {}), 400, 'HTTP_VALIDATION_ERROR');
    });

    it('Idempotency-Key ausente retorna 400 HTTP_VALIDATION_ERROR', async () => {
      const { controller } = setup();
      await expectProblem(controller.importAgenda(makeFile(), undefined, {}), 400, 'HTTP_VALIDATION_ERROR');
    });

    it('extensión .xlsx retorna 415 AGENDA_ARTIFACT_UNSUPPORTED', async () => {
      const { controller } = setup();
      await expectProblem(
        controller.importAgenda(makeFile({ originalname: 'agenda.xlsx' }), 'key-001', {}),
        415,
        'AGENDA_ARTIFACT_UNSUPPORTED',
      );
    });

    it('extensión .csv retorna 415 AGENDA_ARTIFACT_UNSUPPORTED', async () => {
      const { controller } = setup();
      await expectProblem(
        controller.importAgenda(makeFile({ originalname: 'agenda.csv' }), 'key-001', {}),
        415,
        'AGENDA_ARTIFACT_UNSUPPORTED',
      );
    });

    it('sin autenticación retorna 401 AUTHENTICATION_REQUIRED', async () => {
      const { controller } = setup({
        resolve: vi.fn().mockRejectedValue(new AuthenticationRequiredError()),
      });
      await expectProblem(controller.importAgenda(makeFile(), 'key-001', {}), 401, 'AUTHENTICATION_REQUIRED');
    });

    it('PERMISSION_DENIED del use case retorna 403', async () => {
      const { controller, importAgenda } = setup();
      importAgenda.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'internal'));
      await expectProblem(controller.importAgenda(makeFile(), 'key-001', {}), 403, 'PERMISSION_DENIED');
    });

    it('LayoutRejectedError retorna 422 AGENDA_LAYOUT_REJECTED con importAttemptId opaco', async () => {
      const { controller, importAgenda } = setup();
      importAgenda.execute.mockRejectedValue(new LayoutRejectedError('layout inválido'));
      const problem = await expectProblem(
        controller.importAgenda(makeFile(), 'key-001', {}),
        422,
        'AGENDA_LAYOUT_REJECTED',
      );
      expect(problem).toHaveProperty('importAttemptId');
      // Internal detail must not leak
      expect(JSON.stringify(problem)).not.toContain('layout inválido');
      expect(JSON.stringify(problem)).not.toContain('filename');
    });

    it('IDEMPOTENCY_KEY_REUSED retorna 409', async () => {
      const { controller, importAgenda } = setup();
      importAgenda.execute.mockRejectedValue(new ApplicationError('IDEMPOTENCY_KEY_REUSED', 'internal'));
      await expectProblem(controller.importAgenda(makeFile(), 'key-001', {}), 409, 'IDEMPOTENCY_KEY_REUSED');
    });

    it('error desconocido retorna 500 AGENDA_IMPORT_FAILED con importAttemptId', async () => {
      const { controller, importAgenda } = setup();
      importAgenda.execute.mockRejectedValue(new Error('unexpected db error'));
      const problem = await expectProblem(
        controller.importAgenda(makeFile(), 'key-001', {}),
        500,
        'AGENDA_IMPORT_FAILED',
      );
      expect(problem).toHaveProperty('importAttemptId');
      // Internal message must not leak
      expect(JSON.stringify(problem)).not.toContain('unexpected db error');
    });

    it('tenant NO puede inyectarse desde headers arbitrarios — contexto viene del resolver', async () => {
      const { controller, importAgenda } = setup();
      await controller.importAgenda(makeFile(), 'key-001', {
        headers: { 'x-tenant-id': 'tenant-forged', 'x-database': 'forged-db' },
      });
      expect(importAgenda.execute).toHaveBeenCalledWith(
        expect.objectContaining({ context: trustedContext }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /agenda-imports
  // -------------------------------------------------------------------------

  describe('listAgendaImports (GET /agenda-imports)', () => {
    it('devuelve página con items y nextCursor', async () => {
      const { controller, listAgendaImports } = setup({
        listResult: {
          items: [
            {
              importacionId,
              agendaDate: '2026-08-25',
              importedAt: new Date('2026-08-25T10:00:00Z'),
              outcome: 'IMPORTED',
              metrics: sampleMetrics,
            },
          ],
          nextCursor: 'next-opaque',
        },
      });
      const result = await controller.listAgendaImports('2026-08-25', undefined, '10', {}) as Record<string, unknown>;
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('nextCursor', 'next-opaque');
      expect(result).not.toHaveProperty('total');
      expect(listAgendaImports.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          agendaDate: '2026-08-25',
          pagination: { cursor: undefined, limit: 10 },
          context: trustedContext,
        }),
      );
    });

    it('limit ausente retorna 400 HTTP_VALIDATION_ERROR', async () => {
      const { controller } = setup();
      await expectProblem(
        controller.listAgendaImports(undefined, undefined, undefined, {}),
        400,
        'HTTP_VALIDATION_ERROR',
      );
    });

    it('sin autenticación retorna 401', async () => {
      const { controller } = setup({
        resolve: vi.fn().mockRejectedValue(new AuthenticationRequiredError()),
      });
      await expectProblem(
        controller.listAgendaImports(undefined, undefined, '10', {}),
        401,
        'AUTHENTICATION_REQUIRED',
      );
    });

    it('PERMISSION_DENIED retorna 403', async () => {
      const { controller, listAgendaImports } = setup();
      listAgendaImports.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'internal'));
      await expectProblem(
        controller.listAgendaImports(undefined, undefined, '10', {}),
        403,
        'PERMISSION_DENIED',
      );
    });

    it('cursor y limit opcionales se propagan correctamente', async () => {
      const { controller, listAgendaImports } = setup();
      await controller.listAgendaImports(undefined, 'opaque-cursor', '25', {});
      expect(listAgendaImports.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: { cursor: 'opaque-cursor', limit: 25 },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /agenda-imports/:id
  // -------------------------------------------------------------------------

  describe('getAgendaImportResult (GET /agenda-imports/:id)', () => {
    it('devuelve summary y registros', async () => {
      const { controller, getAgendaImportResult } = setup();
      const result = await controller.getAgendaImportResult(importacionId, {}) as Record<string, unknown>;
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('registros');
      expect(getAgendaImportResult.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          importacionId: expect.objectContaining({ value: importacionId }),
          context: trustedContext,
        }),
      );
    });

    it('UUID inválido retorna 400 sin reflejar el valor', async () => {
      const { controller } = setup();
      const badId = 'not-a-uuid-at-all';
      const problem = await expectProblem(
        controller.getAgendaImportResult(badId, {}),
        400,
        'HTTP_VALIDATION_ERROR',
      );
      expect(JSON.stringify(problem)).not.toContain(badId);
    });

    it('AGENDA_IMPORT_NOT_FOUND retorna 404', async () => {
      const { controller, getAgendaImportResult } = setup();
      getAgendaImportResult.execute.mockRejectedValue(
        new ApplicationError('AGENDA_IMPORT_NOT_FOUND', 'internal'),
      );
      await expectProblem(
        controller.getAgendaImportResult(importacionId, {}),
        404,
        'AGENDA_IMPORT_NOT_FOUND',
      );
    });

    it('PERMISSION_DENIED retorna 403', async () => {
      const { controller, getAgendaImportResult } = setup();
      getAgendaImportResult.execute.mockRejectedValue(
        new ApplicationError('PERMISSION_DENIED', 'internal'),
      );
      await expectProblem(
        controller.getAgendaImportResult(importacionId, {}),
        403,
        'PERMISSION_DENIED',
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /agendas/:date
  // -------------------------------------------------------------------------

  describe('getAgendaDaySummary (GET /agendas/:date)', () => {
    it('devuelve resumen del día con conteos', async () => {
      const { controller } = setup();
      const result = await controller.getAgendaDaySummary('2026-08-25', {}) as Record<string, unknown>;
      expect(result).toMatchObject({
        agendaDate: '2026-08-25',
        activeAppointments: 3,
        physicians: 1,
        services: 1,
      });
    });

    it('fecha inválida retorna 400 HTTP_VALIDATION_ERROR', async () => {
      const { controller } = setup();
      await expectProblem(
        controller.getAgendaDaySummary('not-a-date', {}),
        400,
        'HTTP_VALIDATION_ERROR',
      );
    });

    it('AGENDA_NOT_FOUND retorna 404', async () => {
      const { controller, getAgendaDaySummary } = setup();
      getAgendaDaySummary.execute.mockRejectedValue(
        new ApplicationError('AGENDA_NOT_FOUND', 'internal'),
      );
      await expectProblem(
        controller.getAgendaDaySummary('2026-08-25', {}),
        404,
        'AGENDA_NOT_FOUND',
      );
    });

    it('sin autenticación retorna 401', async () => {
      const { controller } = setup({
        resolve: vi.fn().mockRejectedValue(new AuthenticationRequiredError()),
      });
      await expectProblem(
        controller.getAgendaDaySummary('2026-08-25', {}),
        401,
        'AUTHENTICATION_REQUIRED',
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /agendas/:date/preparation-items
  // -------------------------------------------------------------------------

  describe('getAgendaPreparationList (GET /agendas/:date/preparation-items)', () => {
    const sampleItem = {
      folio: 'FOLIO-001',
      nombrePaciente: 'PACIENTE',
      expediente: { original: 'EXP001', reference: null },
      tipoDerechohabiente: 'PENSIONISTA',
      tipoConsulta: 'FIRST_TIME' as const,
      agendaDate: '2026-08-25',
      appointmentTime: '08:00',
      medico: { numeroEmpleado: '12345', nombre: 'DR X' },
      servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA GENERAL' },
    };

    it('devuelve página cursor-based sin total ni hasMore', async () => {
      const { controller, getAgendaPreparationList } = setup({
        prepPage: { items: [sampleItem], nextCursor: null },
      });
      const result = await controller.getAgendaPreparationList(
        '2026-08-25', 'APPOINTMENT_TIME_ASC', undefined, '20', {},
      ) as Record<string, unknown>;
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('nextCursor', null);
      expect(result).not.toHaveProperty('total');
      expect(result).not.toHaveProperty('hasMore');
      expect(getAgendaPreparationList.execute).toHaveBeenCalledWith({
        agendaDate: AgendaFecha.parse('2026-08-25'),
        order: 'APPOINTMENT_TIME_ASC',
        pagination: { cursor: undefined, limit: 20 },
        context: trustedContext,
      });
    });

    it('order PATIENT_NAME_ASC se propaga', async () => {
      const { controller, getAgendaPreparationList } = setup();
      await controller.getAgendaPreparationList('2026-08-25', 'PATIENT_NAME_ASC', undefined, '10', {});
      expect(getAgendaPreparationList.execute).toHaveBeenCalledWith(
        expect.objectContaining({ order: 'PATIENT_NAME_ASC' }),
      );
    });

    it('order ausente usa APPOINTMENT_TIME_ASC por defecto', async () => {
      const { controller, getAgendaPreparationList } = setup();
      await controller.getAgendaPreparationList('2026-08-25', undefined, undefined, '10', {});
      expect(getAgendaPreparationList.execute).toHaveBeenCalledWith(
        expect.objectContaining({ order: 'APPOINTMENT_TIME_ASC' }),
      );
    });

    it('order inválido retorna 400 HTTP_VALIDATION_ERROR', async () => {
      const { controller } = setup();
      await expectProblem(
        controller.getAgendaPreparationList('2026-08-25', 'INVALID_ORDER', undefined, '20', {}),
        400,
        'HTTP_VALIDATION_ERROR',
      );
    });

    it('items no contienen turno, consultorio ni destino', async () => {
      const { controller } = setup({
        prepPage: { items: [sampleItem], nextCursor: null },
      });
      const result = await controller.getAgendaPreparationList(
        '2026-08-25', undefined, undefined, '10', {},
      ) as { items: unknown[] };
      const json = JSON.stringify(result.items[0]);
      expect(json).not.toContain('turno');
      expect(json).not.toContain('consultorio');
      expect(json).not.toContain('destino');
    });
  });

  // -------------------------------------------------------------------------
  // GET /agendas/:date/preparation-items/print
  // -------------------------------------------------------------------------

  describe('printAgendaPreparationList (GET /agendas/:date/preparation-items/print)', () => {
    const printItem = (folio: string, appointmentTime: string) => ({
      folio,
      nombrePaciente: `PACIENTE_${folio}`,
      expediente: { original: folio, reference: null },
      tipoDerechohabiente: 'PENSIONISTA',
      tipoConsulta: 'FIRST_TIME' as const,
      agendaDate: '2026-08-25',
      appointmentTime,
      medico: { numeroEmpleado: '1', nombre: 'DR X' },
      servicioEspecialidad: { codigo: 'S', nombre: 'SVC' },
    });

    it('devuelve colección completa sin cursor', async () => {
      const { controller, printAgendaPreparationList } = setup({
        printItems: [printItem('F1', '08:00'), printItem('F2', '09:00')],
      });
      const result = await controller.printAgendaPreparationList('2026-08-25', undefined, {}) as { items: unknown[] };
      expect(result.items).toHaveLength(2);
      expect(result).not.toHaveProperty('nextCursor');
      expect(printAgendaPreparationList.execute).toHaveBeenCalledWith({
        agendaDate: AgendaFecha.parse('2026-08-25'),
        order: 'APPOINTMENT_TIME_ASC',
        context: trustedContext,
      });
    });

    it('fecha inválida retorna 400', async () => {
      const { controller } = setup();
      await expectProblem(
        controller.printAgendaPreparationList('2026-13-01', undefined, {}),
        400,
        'HTTP_VALIDATION_ERROR',
      );
    });

    it('PERMISSION_DENIED retorna 403', async () => {
      const { controller, printAgendaPreparationList } = setup();
      printAgendaPreparationList.execute.mockRejectedValue(
        new ApplicationError('PERMISSION_DENIED', 'internal'),
      );
      await expectProblem(
        controller.printAgendaPreparationList('2026-08-25', undefined, {}),
        403,
        'PERMISSION_DENIED',
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /agenda-imports/:id/incidents
  // -------------------------------------------------------------------------

  describe('getAgendaImportIncidents (GET /agenda-imports/:id/incidents)', () => {
    it('devuelve incidencias paginadas con nextCursor', async () => {
      const { controller } = setup({
        incidents: [
          { incidenciaId: 'inc-1', registroId: 'reg-1', sourcePosition: 2, type: 'PHYSICIAN_NOT_RESOLVED' },
          { incidenciaId: 'inc-2', registroId: 'reg-2', sourcePosition: 3, type: 'REQUIRED_DATA_MISSING' },
        ],
      });
      const result = await controller.getAgendaImportIncidents(importacionId, undefined, '1', {}) as Record<string, unknown>;
      expect(result).toHaveProperty('items');
      expect((result.items as unknown[]).length).toBe(1);
      expect(result).toHaveProperty('nextCursor', '1');
    });

    it('página vacía devuelve nextCursor null', async () => {
      const { controller } = setup({ incidents: [] });
      const result = await controller.getAgendaImportIncidents(importacionId, undefined, '10', {}) as Record<string, unknown>;
      expect(result).toHaveProperty('items');
      expect((result.items as unknown[]).length).toBe(0);
      expect(result).toHaveProperty('nextCursor', null);
    });

    it('PERMISSION_DENIED retorna 403', async () => {
      const { controller, getAgendaImportIncidents } = setup();
      getAgendaImportIncidents.execute.mockRejectedValue(
        new ApplicationError('PERMISSION_DENIED', 'internal'),
      );
      await expectProblem(
        controller.getAgendaImportIncidents(importacionId, undefined, '10', {}),
        403,
        'PERMISSION_DENIED',
      );
    });

    it('UUID inválido retorna 400', async () => {
      const { controller } = setup();
      await expectProblem(
        controller.getAgendaImportIncidents('not-uuid', undefined, '10', {}),
        400,
        'HTTP_VALIDATION_ERROR',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('tenant NO puede inyectarse desde query params', async () => {
      const { controller, getAgendaDaySummary } = setup();
      await controller.getAgendaDaySummary('2026-08-25', {
        query: { tenantId: 'forged-tenant', databaseName: 'forged-db' },
      });
      expect(getAgendaDaySummary.execute).toHaveBeenCalledWith(
        expect.objectContaining({ context: trustedContext }),
      );
    });

    it('requestId y correlationId no pueden falsificarse desde headers arbitrarios', async () => {
      const { controller, getAgendaDaySummary } = setup();
      await controller.getAgendaDaySummary('2026-08-25', {
        headers: { 'x-request-id': 'forged-request', 'x-correlation-id': 'forged-corr' },
      });
      expect(getAgendaDaySummary.execute).toHaveBeenCalledWith(
        expect.objectContaining({ context: trustedContext }),
      );
      expect(trustedContext.requestId).toBe('request-trusted');
      expect(trustedContext.correlationId).toBe('correlation-trusted');
    });

    it('tenant forjado en import request — contexto viene exclusivamente del resolver', async () => {
      const { controller, importAgenda } = setup();
      await controller.importAgenda(makeFile(), 'key-001', {
        headers: { 'x-tenant-id': 'tenant-forged', 'x-database': 'forged-db' },
      });
      expect(importAgenda.execute).toHaveBeenCalledWith(
        expect.objectContaining({ context: trustedContext }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Module registration
  // -------------------------------------------------------------------------

  describe('AgendaApiModule.register', () => {
    it('registra controller, mapper y 8 tokens de dependencia', () => {
      const { resolver, importAgenda, getAgendaImportResult, listAgendaImports,
        getAgendaDaySummary, getAgendaPreparationList, printAgendaPreparationList,
        getAgendaImportIncidents } = setup();

      const dynamicModule = AgendaApiModule.register({
        requestContextResolver: resolver,
        importAgenda: importAgenda as unknown as ImportAgenda,
        getAgendaImportResult: getAgendaImportResult as unknown as GetAgendaImportResult,
        listAgendaImports: listAgendaImports as unknown as ListAgendaImports,
        getAgendaDaySummary: getAgendaDaySummary as unknown as GetAgendaDaySummary,
        getAgendaPreparationList: getAgendaPreparationList as unknown as GetAgendaPreparationList,
        printAgendaPreparationList: printAgendaPreparationList as unknown as PrintAgendaPreparationList,
        getAgendaImportIncidents: getAgendaImportIncidents as unknown as GetAgendaImportIncidents,
      });

      expect(dynamicModule.controllers).toContain(AgendaController);
      // 1 mapper + 8 DI token providers
      expect(dynamicModule.providers).toHaveLength(9);
    });
  });
});
