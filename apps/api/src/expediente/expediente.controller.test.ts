import { HttpException } from '@nestjs/common';
import {
  ApplicationError,
  type AcceptCustody,
  type DispatchExpediente,
  type GetExpediente,
  type GetExpedienteTimeline,
  type SearchExpedientesByNumero,
} from '@sigac/archive-operations';
import type { RequestContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module.js';
import {
  ApiProblemMapper,
  AuthenticationRequiredError,
  type ProblemDetails,
} from './api-errors.js';
import type { AuthenticatedRequestContextResolver } from './expediente-api.contracts.js';
import { ExpedienteApiModule } from './expediente-api.module.js';
import { ExpedienteController } from './expediente.controller.js';

const expedienteId = '9b2d3958-f383-4c53-9041-09172fdd408f';
const locationId = '11111111-1111-4111-8111-111111111111';

const trustedContext: RequestContext = {
  actor: {
    actorId: 'actor-trusted',
    roles: new Set(['ARCHIVISTA']),
    permissions: new Set(['EXPEDIENT_VIEW', 'EXPEDIENT_DISPATCH', 'CUSTODY_ACCEPT']),
    tenantIds: new Set(['tenant-trusted']),
  },
  tenant: {
    tenantId: 'tenant-trusted',
    slug: 'hospital-trusted',
    hospitalId: 'hospital-trusted',
    databaseName: 'allowlisted_database',
    timezone: 'America/Mexico_City',
  },
  requestId: 'request-trusted',
  correlationId: 'correlation-trusted',
  source: 'WEB',
};

function dispatchBody(overrides: Record<string, unknown> = {}) {
  return {
    destination: { id: locationId, codigo: 'CONS-1', descripcion: 'Consultorio' },
    intendedCustodian: { type: 'SERVICIO', reference: 'receptor-1' },
    businessReference: { type: 'VALE', id: null },
    expectedRowVersion: '42',
    ...overrides,
  };
}

function acceptBody(overrides: Record<string, unknown> = {}) {
  return {
    receptor: { type: 'MEDICO', reference: 'receptor-2', service: null },
    ubicacionDestino: { id: locationId, codigo: 'CONS-1', descripcion: 'Consultorio' },
    businessReference: { type: 'VALE', id: 'vale-1' },
    expectedRowVersion: '43',
    ...overrides,
  };
}

function setup(options: {
  resolve?: AuthenticatedRequestContextResolver['resolve'];
  getResult?: unknown;
  timelineResult?: unknown;
  searchResult?: unknown;
} = {}) {
  const resolver: AuthenticatedRequestContextResolver = {
    resolve: options.resolve ?? vi.fn().mockResolvedValue(trustedContext),
  };
  const getExpediente = {
    execute: vi.fn().mockResolvedValue(options.getResult ?? {
      id: expedienteId,
      expedienteNumero: 'PERR810604/10',
      pacienteRef: { id: 'patient-ref', displayLabel: 'Operativo' },
      estadoOperativo: 'APARTADO',
      ubicacionActual: null,
      custodiaActual: null,
      prestamoActivo: null,
      solicitudActiva: null,
      incidenciasAbiertas: [],
      capabilities: ['DISPATCH'],
      rowVersion: 9_007_199_254_740_993n,
    }),
  };
  const getExpedienteTimeline = {
    execute: vi.fn().mockResolvedValue(options.timelineResult ?? { items: [], nextCursor: null }),
  };
  const searchExpedientesByNumero = {
    execute: vi.fn().mockResolvedValue(options.searchResult ?? []),
  };
  const dispatchExpediente = { execute: vi.fn().mockResolvedValue({ name: 'internal-event' }) };
  const acceptCustody = { execute: vi.fn().mockResolvedValue({ name: 'internal-event' }) };
  const controller = new ExpedienteController(
    resolver,
    getExpediente as unknown as GetExpediente,
    getExpedienteTimeline as unknown as GetExpedienteTimeline,
    searchExpedientesByNumero as unknown as SearchExpedientesByNumero,
    dispatchExpediente as unknown as DispatchExpediente,
    acceptCustody as unknown as AcceptCustody,
    new ApiProblemMapper(),
  );
  return {
    controller,
    resolver,
    getExpediente,
    getExpedienteTimeline,
    searchExpedientesByNumero,
    dispatchExpediente,
    acceptCustody,
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

describe('ExpedienteController T-11', () => {
  it.each([
    [0, []],
    [1, [{ expedienteId, expedienteNumero: 'PERR810604/10' }]],
    [2, [
      { expedienteId, expedienteNumero: 'PERR810604/10' },
      { expedienteId: '2d414e5b-9ef3-45d1-8be3-e71daf358595', expedienteNumero: 'PERR810604/10' },
    ]],
  ] as const)('Search retorna wrapper items para %s resultado(s)', async (_count, items) => {
    const { controller, searchExpedientesByNumero } = setup({ searchResult: items });
    await expect(controller.search('PERR810604-10', {})).resolves.toEqual({ items });
    expect(searchExpedientesByNumero.execute).toHaveBeenCalledWith({
      numero: expect.objectContaining({
        rfcBase: 'PERR810604',
        codigoDerechohabiente: '10',
      }),
      context: trustedContext,
    });
  });

  it.each([
    [undefined, 'REQUIRED'],
    ['', 'REQUIRED'],
    ['numero-secreto-invalido', 'INVALID_FORMAT'],
  ] as const)('Search valida numero %s sin reflejarlo', async (numero, fieldCode) => {
    const { controller, resolver, searchExpedientesByNumero } = setup();
    const problem = await expectProblem(
      controller.search(numero, {}),
      400,
      'HTTP_VALIDATION_ERROR',
    );
    expect(problem.errors).toContainEqual({ field: 'numero', code: fieldCode });
    if (numero) expect(JSON.stringify(problem)).not.toContain(numero);
    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(searchExpedientesByNumero.execute).not.toHaveBeenCalled();
  });

  it('Search retorna 401 cuando RequestContext resolver rechaza autenticación', async () => {
    const { controller, searchExpedientesByNumero } = setup({
      resolve: vi.fn().mockRejectedValue(new AuthenticationRequiredError()),
    });
    await expectProblem(
      controller.search('PERR810604/10', {}),
      401,
      'AUTHENTICATION_REQUIRED',
    );
    expect(searchExpedientesByNumero.execute).not.toHaveBeenCalled();
  });

  it('Search mapea PERMISSION_DENIED a 403', async () => {
    const { controller, searchExpedientesByNumero } = setup();
    searchExpedientesByNumero.execute.mockRejectedValue(
      new ApplicationError('PERMISSION_DENIED', 'internal'),
    );
    await expectProblem(controller.search('PERR81060410', {}), 403, 'PERMISSION_DENIED');
  });

  it('Search usa sólo el contexto trusted aunque la request intente falsificar tenant', async () => {
    const { controller, searchExpedientesByNumero } = setup();
    await controller.search('PERR810604/10', {
      query: { tenant: 'tenant-forged', databaseName: 'forged-db' },
    });
    expect(searchExpedientesByNumero.execute).toHaveBeenCalledWith(expect.objectContaining({
      context: trustedContext,
    }));
  });

  it('GET delega GetExpediente, propaga RequestContext y serializa bigint sin number', async () => {
    const { controller, getExpediente } = setup();
    const response = await controller.getById(expedienteId, { authenticated: true }) as {
      rowVersion: string;
    };
    expect(response.rowVersion).toBe('9007199254740993');
    expect(getExpediente.execute).toHaveBeenCalledWith({
      expedienteId: expect.objectContaining({ value: expedienteId }),
      context: trustedContext,
    });
  });

  it.each([
    ['EXPEDIENTE_NOT_FOUND', 404],
    ['PERMISSION_DENIED', 403],
  ] as const)('GET mapea %s sin disclosure', async (code, status) => {
    const { controller, getExpediente } = setup();
    getExpediente.execute.mockRejectedValue(new ApplicationError(code, 'sensitive internal text'));
    const problem = await expectProblem(controller.getById(expedienteId, {}), status, code);
    expect(JSON.stringify(problem)).not.toContain('sensitive internal text');
    expect(JSON.stringify(problem)).not.toContain('tenant-other');
  });

  it('request no autenticada retorna AUTHENTICATION_REQUIRED/401', async () => {
    const { controller } = setup({
      resolve: vi.fn().mockRejectedValue(new AuthenticationRequiredError()),
    });
    await expectProblem(controller.getById(expedienteId, {}), 401, 'AUTHENTICATION_REQUIRED');
  });

  it('timeline conserva vacío y cursor opaco sin total', async () => {
    const opaque = 'opaque.not-interpreted';
    const { controller, getExpedienteTimeline } = setup();
    const response = await controller.getTimeline(expedienteId, opaque, '25', {}) as Record<string, unknown>;
    expect(response).toEqual({ items: [], nextCursor: null });
    expect(response).not.toHaveProperty('total');
    expect(getExpedienteTimeline.execute).toHaveBeenCalledWith({
      expedienteId: expect.objectContaining({ value: expedienteId }),
      pagination: { cursor: opaque, limit: 25 },
      context: trustedContext,
    });
  });

  it('timeline serializa página con nextCursor y fechas', async () => {
    const { controller } = setup({
      timelineResult: {
        items: [{ movimientoId: 'm1', occurredAt: new Date('2026-08-15T12:00:00Z') }],
        nextCursor: 'next-opaque',
      },
    });
    await expect(controller.getTimeline(expedienteId, undefined, '1', {})).resolves.toEqual({
      items: [{ movimientoId: 'm1', occurredAt: '2026-08-15T12:00:00.000Z' }],
      nextCursor: 'next-opaque',
    });
  });

  it('Dispatch convierte bigint, usa context trusted y retorna body vacío', async () => {
    const { controller, dispatchExpediente } = setup();
    await expect(controller.dispatch(expedienteId, dispatchBody(), {})).resolves.toBeUndefined();
    expect(dispatchExpediente.execute).toHaveBeenCalledWith(expect.objectContaining({
      expectedRowVersion: 42n,
      context: trustedContext,
    }));
  });

  it.each([
    ['REQUEST_INVALID_TRANSITION', 409],
    ['OPTIMISTIC_LOCK_CONFLICT', 409],
  ] as const)('Dispatch mapea %s a %s', async (code, status) => {
    const { controller, dispatchExpediente } = setup();
    dispatchExpediente.execute.mockRejectedValue(new ApplicationError(code, 'internal'));
    await expectProblem(controller.dispatch(expedienteId, dispatchBody(), {}), status, code);
  });

  it('AcceptCustody convierte bigint y retorna body vacío sin DomainEvent', async () => {
    const { controller, acceptCustody } = setup();
    await expect(controller.acceptCustody(expedienteId, acceptBody(), {})).resolves.toBeUndefined();
    expect(acceptCustody.execute).toHaveBeenCalledWith(expect.objectContaining({
      expectedRowVersion: 43n,
      context: trustedContext,
    }));
  });

  it.each([
    ['REQUEST_INVALID_TRANSITION', 409],
    ['OPTIMISTIC_LOCK_CONFLICT', 409],
  ] as const)('AcceptCustody mapea %s a %s', async (code, status) => {
    const { controller, acceptCustody } = setup();
    acceptCustody.execute.mockRejectedValue(new ApplicationError(code, 'internal'));
    await expectProblem(controller.acceptCustody(expedienteId, acceptBody(), {}), status, code);
  });

  it('UUID inválido retorna validation 400 sin reflejar el valor', async () => {
    const received = 'secret-invalid-uuid';
    const { controller } = setup();
    const problem = await expectProblem(controller.getById(received, {}), 400, 'HTTP_VALIDATION_ERROR');
    expect(JSON.stringify(problem)).not.toContain(received);
    expect(problem.errors).toContainEqual({ field: 'id', code: 'INVALID_FORMAT' });
  });

  it('bigint inválido retorna validation 400', async () => {
    const { controller } = setup();
    const problem = await expectProblem(
      controller.dispatch(expedienteId, dispatchBody({ expectedRowVersion: '42.1' }), {}),
      400,
      'HTTP_VALIDATION_ERROR',
    );
    expect(problem.errors).toContainEqual({ field: 'expectedRowVersion', code: 'INVALID_FORMAT' });
  });

  it('campo requerido ausente e invalid type usan field codes canónicos', async () => {
    const { controller } = setup();
    const missing = dispatchBody();
    delete (missing as Partial<typeof missing>).destination;
    const required = await expectProblem(
      controller.dispatch(expedienteId, missing, {}), 400, 'HTTP_VALIDATION_ERROR',
    );
    expect(required.errors).toContainEqual({ field: 'destination', code: 'REQUIRED' });

    const invalid = await expectProblem(
      controller.dispatch(expedienteId, dispatchBody({ expectedRowVersion: 42 }), {}),
      400,
      'HTTP_VALIDATION_ERROR',
    );
    expect(invalid.errors).toContainEqual({ field: 'expectedRowVersion', code: 'INVALID_TYPE' });
  });

  it('body/query no falsifican tenant ni tracing y source permanece WEB', async () => {
    const forged = dispatchBody({
      tenantId: 'tenant-forged',
      databaseName: 'forged-db',
      requestId: 'forged-request',
      correlationId: 'forged-correlation',
    });
    const { controller, dispatchExpediente, getExpediente } = setup();
    await expectProblem(controller.dispatch(expedienteId, forged, {}), 400, 'HTTP_VALIDATION_ERROR');
    expect(dispatchExpediente.execute).not.toHaveBeenCalled();

    await controller.getById(expedienteId, {
      query: { tenant: 'tenant-forged', requestId: 'forged', correlationId: 'forged' },
    });
    expect(dispatchExpediente.execute).not.toHaveBeenCalled();
    expect(getExpediente.execute).toHaveBeenCalledWith(expect.objectContaining({
      context: trustedContext,
    }));
    expect(trustedContext.source).toBe('WEB');
    expect(trustedContext.requestId).not.toBe(trustedContext.correlationId);
  });

  it('mapea INSUFFICIENT_ENABLING_SOURCE a 403', async () => {
    const { controller, dispatchExpediente } = setup();
    dispatchExpediente.execute.mockRejectedValue(
      new ApplicationError('INSUFFICIENT_ENABLING_SOURCE', 'internal'),
    );
    await expectProblem(
      controller.dispatch(expedienteId, dispatchBody(), {}),
      403,
      'INSUFFICIENT_ENABLING_SOURCE',
    );
  });

  it('el módulo configurable registra providers explícitos y AppModule no monta fakes', () => {
    const setupResult = setup();
    const dynamicModule = ExpedienteApiModule.register({
      requestContextResolver: setupResult.resolver,
      getExpediente: setupResult.getExpediente as unknown as GetExpediente,
      getExpedienteTimeline: setupResult.getExpedienteTimeline as unknown as GetExpedienteTimeline,
      searchExpedientesByNumero: setupResult.searchExpedientesByNumero as unknown as SearchExpedientesByNumero,
      dispatchExpediente: setupResult.dispatchExpediente as unknown as DispatchExpediente,
      acceptCustody: setupResult.acceptCustody as unknown as AcceptCustody,
    });
    expect(dynamicModule.controllers).toContain(ExpedienteController);
    expect(dynamicModule.providers).toHaveLength(7);
    expect(Reflect.getMetadata('imports', AppModule) ?? []).not.toContain(ExpedienteApiModule);
    expect(JSON.stringify(Reflect.getMetadata('providers', AppModule) ?? [])).not.toContain('fake');
  });
});
