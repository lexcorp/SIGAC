/**
 * T-34 — ValeArchivoController HTTP tests
 *
 * Fuente: REQ-VA-001..REQ-VA-007, design.md §9, ADR-0033.
 *
 * Patrón idéntico a agenda.controller.test.ts:
 *   - Se instancia el controller directamente (sin HTTP server).
 *   - Use cases son mocks de Vitest.
 *   - Se verifican: status codes, RFC 7807 bodies, tenant isolation,
 *     permisos y que use cases no se llaman cuando debe rechazar.
 */

import { HttpException } from '@nestjs/common';
import type {
  CerrarValeAdministrativo,
  ConsultarVale,
  GenerarPdfVale,
  IniciarBusqueda,
  ListarVales,
  RegistrarEntrega,
  RegistrarLocalizacion,
  RegistrarVale,
} from '@sigac/vale-archivo';
import { Readable } from 'node:stream';
import type { RequestContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { ValeArchivoApiProblemMapper } from './vale-archivo-api-errors.js';
import type { AuthenticatedRequestContextResolver } from './vale-archivo-api.contracts.js';
import { ValeArchivoController } from './vale-archivo.controller.js';
import { ApplicationError } from '@sigac/vale-archivo';
import { DomainError } from '@sigac/domain-kernel';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ITEM_ID = 'ffffffff-1111-4222-8333-444444444444';

const trustedCtx: RequestContext = {
  actor: {
    actorId: 'actor-t34',
    roles: new Set(['ARCHIVISTA']),
    permissions: new Set(['REQUEST_CREATE', 'ARCHIVE_REQUEST_VIEW', 'ARCHIVE_REQUEST_PROCESS', 'ARCHIVE_REQUEST_DELIVER']),
    tenantIds: new Set(['tenant-t34']),
  },
  tenant: { tenantId: 'tenant-t34', slug: 'hospital-t34', hospitalId: 'hosp-t34', databaseName: 'sigac_t34', timezone: 'America/Mexico_City' },
  requestId: 'req-t34', correlationId: 'corr-t34', source: 'WEB',
};

const validBody = {
  numeroVale:        'VA-T34-001',
  fechaSolicitud:    '2026-08-26',
  fechaRecepcion:    '2026-08-26',
  unidadSolicitante: 'DIRECCIÓN MÉDICA',
  solicitanteNombre: 'Dr. T34',
  solicitanteCargo:  'Director',
  autorizadorNombre: 'Dra. T34',
  autorizadorCargo:  'Subdirectora',
  items: [{ expedienteNumero: 'EXP-T34-001', pacienteNombre: 'PACIENTE T34', especialidad: 'MEDICINA INTERNA' }],
};

const fakeSummary = {
  id: VALE_ID, numeroVale: 'VA-T34-001', fechaSolicitud: new Date('2026-08-26'),
  unidadSolicitante: 'DIRECCIÓN', solicitanteNombre: 'Dr. T34', estado: 'RECIBIDA' as const, itemCount: 1,
};

const fakeSnapshot = {
  id: VALE_ID, numeroVale: 'VA-T34-001', fechaSolicitud: new Date(), fechaRecepcion: new Date(),
  unidadSolicitante: 'DIRECCIÓN',
  solicitante: { nombre: 'Dr. T34', cargo: 'Director' },
  autorizador: { nombre: 'Dra. T34', cargo: 'Subdirectora' },
  estado: 'RECIBIDA' as const, creadoPor: 'actor-t34',
  busquedaIniciadaPor: null, busquedaIniciadaAt: null,
  entregadoPor: null, entregadoAt: null, receptorEntrega: null,
  createdAt: new Date(), updatedAt: new Date(),
  items: [{ id: ITEM_ID, valeId: VALE_ID, expedienteNumero: 'EXP-T34-001', pacienteNombre: 'PACIENTE T34', especialidad: 'MEDICINA INTERNA', estadoBusqueda: 'PENDIENTE' as const, ubicacionEncontrada: null, observaciones: null }],
};

function setup(opts: { resolve?: AuthenticatedRequestContextResolver['resolve'] } = {}) {
  const resolver: AuthenticatedRequestContextResolver = {
    resolve: opts.resolve ?? vi.fn().mockResolvedValue(trustedCtx),
  };
  const registrarVale       = { execute: vi.fn().mockResolvedValue({ id: VALE_ID, numeroVale: 'VA-T34-001', estado: 'RECIBIDA' }) };
  const consultarVale       = { execute: vi.fn().mockResolvedValue(fakeSnapshot) };
  const listarVales         = { execute: vi.fn().mockResolvedValue({ items: [fakeSummary], nextCursor: null }) };
  const iniciarBusqueda     = { execute: vi.fn().mockResolvedValue(undefined) };
  const registrarLocalizacion = { execute: vi.fn().mockResolvedValue(undefined) };
  const registrarEntrega    = { execute: vi.fn().mockResolvedValue(undefined) };
  const cerrarValeAdm       = { execute: vi.fn().mockResolvedValue(undefined) };
  const generarPdfVale      = { execute: vi.fn().mockResolvedValue({
    stream: Readable.from([Buffer.from('%PDF-1.4 test')]),
    filename: 'sm1-14-VA-T34-001-2026-08-26.pdf',
  }) };

  const controller = new ValeArchivoController(
    resolver,
    registrarVale       as unknown as RegistrarVale,
    consultarVale       as unknown as ConsultarVale,
    listarVales         as unknown as ListarVales,
    iniciarBusqueda     as unknown as IniciarBusqueda,
    registrarLocalizacion as unknown as RegistrarLocalizacion,
    registrarEntrega    as unknown as RegistrarEntrega,
    cerrarValeAdm       as unknown as CerrarValeAdministrativo,
    generarPdfVale      as unknown as GenerarPdfVale,
    new ValeArchivoApiProblemMapper(),
  );

  return { controller, resolver, registrarVale, consultarVale, listarVales, iniciarBusqueda, registrarLocalizacion, registrarEntrega, cerrarValeAdm, generarPdfVale };
}

async function expectProblem(promise: Promise<unknown>, status: number, code: string) {
  try { await promise; throw new Error('Expected HttpException'); }
  catch (err) {
    expect(err).toBeInstanceOf(HttpException);
    const body = (err as HttpException).getResponse() as Record<string, unknown>;
    expect((err as HttpException).getStatus()).toBe(status);
    expect(body['code']).toBe(code);
    return body;
  }
}

// ── crearVale ─────────────────────────────────────────────────────────────────

describe('crearVale POST /vale-archivo', () => {
  it('201 con body válido retorna id + estado RECIBIDA', async () => {
    const { controller } = setup();
    const r = await controller.crearVale(validBody, {}) as Record<string, unknown>;
    expect(r['estado']).toBe('RECIBIDA');
    expect(typeof r['id']).toBe('string');
  });

  it('400 cuando items está vacío', async () => {
    const { controller } = setup();
    await expectProblem(
      controller.crearVale({ ...validBody, items: [] }, {}),
      400, 'HTTP_VALIDATION_ERROR',
    );
  });

  it('400 cuando falta campo requerido (numeroVale)', async () => {
    const { controller } = setup();
    await expectProblem(
      controller.crearVale({ ...validBody, numeroVale: '' }, {}),
      400, 'HTTP_VALIDATION_ERROR',
    );
  });

  it('401 cuando el resolver rechaza autenticación', async () => {
    const { controller } = setup({ resolve: vi.fn().mockRejectedValue(new Error('no auth')) });
    await expectProblem(controller.crearVale(validBody, {}), 401, 'AUTHENTICATION_REQUIRED');
  });

  it('403 cuando use case lanza PERMISSION_DENIED', async () => {
    const { controller, registrarVale } = setup();
    registrarVale.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'denied'));
    await expectProblem(controller.crearVale(validBody, {}), 403, 'PERMISSION_DENIED');
  });

  it('422 cuando el Aggregate lanza VALE_REQUIERE_ITEMS (DomainError)', async () => {
    const { controller, registrarVale } = setup();
    registrarVale.execute.mockRejectedValue(new DomainError('VALE_REQUIERE_ITEMS', 'sin items'));
    await expectProblem(controller.crearVale(validBody, {}), 422, 'VALE_REQUIERE_ITEMS');
  });

  it('tenant no puede inyectarse desde el body', async () => {
    const { controller, registrarVale } = setup();
    await controller.crearVale({ ...validBody, context: { tenant: { tenantId: 'forged' } } }, {});
    const [[cmd]] = registrarVale.execute.mock.calls as unknown as [[{ context: RequestContext }]];
    expect(cmd.context.tenant.tenantId).toBe('tenant-t34');
  });
});

// ── listarVales ───────────────────────────────────────────────────────────────

describe('listarVales GET /vale-archivo', () => {
  it('200 retorna página con items y nextCursor', async () => {
    const { controller } = setup();
    const r = await controller.listarVales(undefined, undefined, undefined, undefined, undefined, {}) as Record<string, unknown>;
    expect(Array.isArray(r['items'])).toBe(true);
    expect(r['nextCursor']).toBeNull();
  });

  it('400 con estado inválido', async () => {
    const { controller } = setup();
    await expectProblem(
      controller.listarVales('INVALIDO', undefined, undefined, undefined, undefined, {}),
      400, 'HTTP_VALIDATION_ERROR',
    );
  });

  it('403 cuando use case lanza PERMISSION_DENIED', async () => {
    const { controller, listarVales } = setup();
    listarVales.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'denied'));
    await expectProblem(
      controller.listarVales(undefined, undefined, undefined, undefined, undefined, {}),
      403, 'PERMISSION_DENIED',
    );
  });

  it('propaga filtro estado al use case', async () => {
    const { controller, listarVales } = setup();
    await controller.listarVales('RECIBIDA', undefined, undefined, undefined, undefined, {});
    expect(listarVales.execute).toHaveBeenCalledWith(expect.objectContaining({ estado: 'RECIBIDA' }));
  });

  it('400 con limit > 100', async () => {
    const { controller } = setup();
    await expectProblem(
      controller.listarVales(undefined, undefined, undefined, undefined, '101', {}),
      400, 'HTTP_VALIDATION_ERROR',
    );
  });
});

// ── consultarVale ─────────────────────────────────────────────────────────────

describe('consultarVale GET /vale-archivo/:id', () => {
  it('200 retorna snapshot completo', async () => {
    const { controller } = setup();
    const r = await controller.consultarVale(VALE_ID, {}) as Record<string, unknown>;
    expect(r['id']).toBe(VALE_ID);
    expect(Array.isArray(r['items'])).toBe(true);
  });

  it('400 con UUID inválido', async () => {
    const { controller } = setup();
    await expectProblem(controller.consultarVale('not-a-uuid', {}), 400, 'HTTP_VALIDATION_ERROR');
  });

  it('404 cuando use case lanza VALE_ARCHIVO_NOT_FOUND', async () => {
    const { controller, consultarVale } = setup();
    consultarVale.execute.mockRejectedValue(new ApplicationError('VALE_ARCHIVO_NOT_FOUND', 'nf'));
    await expectProblem(controller.consultarVale(VALE_ID, {}), 404, 'VALE_ARCHIVO_NOT_FOUND');
  });

  it('detail no expone turno ni shift (INV-VA-011)', async () => {
    const { controller } = setup();
    const r = await controller.consultarVale(VALE_ID, {}) as Record<string, unknown>;
    expect(r).not.toHaveProperty('turno');
    expect(r).not.toHaveProperty('shift');
  });
});

// ── iniciarBusqueda ───────────────────────────────────────────────────────────

describe('iniciarBusqueda POST /vale-archivo/:id/iniciar-busqueda', () => {
  it('200 cuando éxito', async () => {
    const { controller } = setup();
    await expect(controller.iniciarBusqueda(VALE_ID, {})).resolves.not.toThrow();
  });

  it('400 con UUID inválido', async () => {
    const { controller } = setup();
    await expectProblem(controller.iniciarBusqueda('bad-id', {}), 400, 'HTTP_VALIDATION_ERROR');
  });

  it('403 cuando use case lanza PERMISSION_DENIED', async () => {
    const { controller, iniciarBusqueda } = setup();
    iniciarBusqueda.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'denied'));
    await expectProblem(controller.iniciarBusqueda(VALE_ID, {}), 403, 'PERMISSION_DENIED');
  });

  it('422 cuando Aggregate lanza INVALID_STATE_TRANSITION (DomainError)', async () => {
    const { controller, iniciarBusqueda } = setup();
    iniciarBusqueda.execute.mockRejectedValue(new DomainError('INVALID_STATE_TRANSITION', 'bad state'));
    await expectProblem(controller.iniciarBusqueda(VALE_ID, {}), 422, 'INVALID_STATE_TRANSITION');
  });

  it('use case no se llama si UUID inválido', async () => {
    const { controller, iniciarBusqueda } = setup();
    await controller.iniciarBusqueda('bad-id', {}).catch(() => undefined);
    expect(iniciarBusqueda.execute).not.toHaveBeenCalled();
  });
});

// ── registrarLocalizacion ─────────────────────────────────────────────────────

describe('registrarLocalizacion PATCH /vale-archivo/:id/items/:itemId', () => {
  const locBody = { estadoBusqueda: 'LOCALIZADO', ubicacionEncontrada: 'Estante A-1' };

  it('200 cuando éxito', async () => {
    const { controller } = setup();
    await expect(controller.registrarLocalizacion(VALE_ID, ITEM_ID, locBody, {})).resolves.not.toThrow();
  });

  it('400 con estadoBusqueda inválido', async () => {
    const { controller } = setup();
    await expectProblem(
      controller.registrarLocalizacion(VALE_ID, ITEM_ID, { estadoBusqueda: 'INVALIDO' }, {}),
      400, 'HTTP_VALIDATION_ERROR',
    );
  });

  it('403 cuando use case lanza PERMISSION_DENIED', async () => {
    const { controller, registrarLocalizacion } = setup();
    registrarLocalizacion.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'denied'));
    await expectProblem(
      controller.registrarLocalizacion(VALE_ID, ITEM_ID, locBody, {}),
      403, 'PERMISSION_DENIED',
    );
  });

  it('404 cuando use case lanza VALE_ARCHIVO_NOT_FOUND', async () => {
    const { controller, registrarLocalizacion } = setup();
    registrarLocalizacion.execute.mockRejectedValue(new ApplicationError('VALE_ARCHIVO_NOT_FOUND', 'nf'));
    await expectProblem(
      controller.registrarLocalizacion(VALE_ID, ITEM_ID, locBody, {}),
      404, 'VALE_ARCHIVO_NOT_FOUND',
    );
  });

  it('422 cuando Aggregate lanza INVALID_STATE_TRANSITION', async () => {
    const { controller, registrarLocalizacion } = setup();
    registrarLocalizacion.execute.mockRejectedValue(new DomainError('INVALID_STATE_TRANSITION', 'bad'));
    await expectProblem(
      controller.registrarLocalizacion(VALE_ID, ITEM_ID, locBody, {}),
      422, 'INVALID_STATE_TRANSITION',
    );
  });

  it('propaga itemId correcto al use case', async () => {
    const { controller, registrarLocalizacion } = setup();
    await controller.registrarLocalizacion(VALE_ID, ITEM_ID, locBody, {});
    expect(registrarLocalizacion.execute).toHaveBeenCalledWith(
      expect.objectContaining({ valeId: VALE_ID, itemId: ITEM_ID, estadoBusqueda: 'LOCALIZADO' }),
    );
  });
});

// ── registrarEntrega ──────────────────────────────────────────────────────────

describe('registrarEntrega POST /vale-archivo/:id/entrega', () => {
  const entregaBody = { receptorEntrega: 'Lic. Receptor', entregadoAt: '2026-08-26T15:00:00Z', itemsEntregados: [ITEM_ID] };

  it('200 cuando éxito', async () => {
    const { controller } = setup();
    await expect(controller.registrarEntrega(VALE_ID, entregaBody, {})).resolves.not.toThrow();
  });

  it('400 si falta receptorEntrega', async () => {
    const { controller } = setup();
    await expectProblem(
      controller.registrarEntrega(VALE_ID, { ...entregaBody, receptorEntrega: '' }, {}),
      400, 'HTTP_VALIDATION_ERROR',
    );
  });

  it('403 cuando use case lanza PERMISSION_DENIED', async () => {
    const { controller, registrarEntrega } = setup();
    registrarEntrega.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'denied'));
    await expectProblem(controller.registrarEntrega(VALE_ID, entregaBody, {}), 403, 'PERMISSION_DENIED');
  });

  it('422 cuando Aggregate lanza INVALID_STATE_TRANSITION', async () => {
    const { controller, registrarEntrega } = setup();
    registrarEntrega.execute.mockRejectedValue(new DomainError('INVALID_STATE_TRANSITION', 'bad'));
    await expectProblem(controller.registrarEntrega(VALE_ID, entregaBody, {}), 422, 'INVALID_STATE_TRANSITION');
  });
});

// ── cerrarVale ────────────────────────────────────────────────────────────────

describe('cerrarVale POST /vale-archivo/:id/cerrar', () => {
  it('200 cuando éxito', async () => {
    const { controller } = setup();
    await expect(controller.cerrarVale(VALE_ID, {}, {})).resolves.not.toThrow();
  });

  it('403 cuando use case lanza PERMISSION_DENIED', async () => {
    const { controller, cerrarValeAdm } = setup();
    cerrarValeAdm.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'denied'));
    await expectProblem(controller.cerrarVale(VALE_ID, {}, {}), 403, 'PERMISSION_DENIED');
  });

  it('404 cuando use case lanza VALE_ARCHIVO_NOT_FOUND', async () => {
    const { controller, cerrarValeAdm } = setup();
    cerrarValeAdm.execute.mockRejectedValue(new ApplicationError('VALE_ARCHIVO_NOT_FOUND', 'nf'));
    await expectProblem(controller.cerrarVale(VALE_ID, {}, {}), 404, 'VALE_ARCHIVO_NOT_FOUND');
  });

  it('422 cuando Aggregate lanza INVALID_STATE_TRANSITION', async () => {
    const { controller, cerrarValeAdm } = setup();
    cerrarValeAdm.execute.mockRejectedValue(new DomainError('INVALID_STATE_TRANSITION', 'bad'));
    await expectProblem(controller.cerrarVale(VALE_ID, {}, {}), 422, 'INVALID_STATE_TRANSITION');
  });

  it('propaga motivo opcional al use case', async () => {
    const { controller, cerrarValeAdm } = setup();
    await controller.cerrarVale(VALE_ID, { motivo: 'Expediente en préstamo activo' }, {});
    expect(cerrarValeAdm.execute).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: 'Expediente en préstamo activo' }),
    );
  });
});

// ── ValeArchivoApiModule registration ────────────────────────────────────────

describe('ValeArchivoApiModule.register', () => {
  it('registra controller, mapper y 9 tokens de dependencia (incl. generarPdfVale)', async () => {
    const { ValeArchivoApiModule } = await import('./vale-archivo-api.module.js');
    const { resolver, registrarVale, consultarVale, listarVales, iniciarBusqueda,
      registrarLocalizacion, registrarEntrega, cerrarValeAdm, generarPdfVale } = setup();

    const mod = ValeArchivoApiModule.register({
      requestContextResolver: resolver,
      registrarVale:            registrarVale            as unknown as RegistrarVale,
      consultarVale:            consultarVale            as unknown as ConsultarVale,
      listarVales:              listarVales              as unknown as ListarVales,
      iniciarBusqueda:          iniciarBusqueda          as unknown as IniciarBusqueda,
      registrarLocalizacion:    registrarLocalizacion    as unknown as RegistrarLocalizacion,
      registrarEntrega:         registrarEntrega         as unknown as RegistrarEntrega,
      cerrarValeAdministrativo: cerrarValeAdm            as unknown as CerrarValeAdministrativo,
      generarPdfVale:           generarPdfVale           as unknown as GenerarPdfVale,
    });

    expect(mod.controllers).toContain(ValeArchivoController);
    // 1 mapper + 9 tokens = 10 providers
    expect(mod.providers).toHaveLength(10);
  });
});

// ── generarPdf GET /vale-archivo/:id/pdf ─────────────────────────────────────

describe('generarPdf GET /vale-archivo/:id/pdf', () => {
  /** Minimal ServerResponse mock for testing header and pipe calls. */
  function makeRes() {
    const headers: Record<string, string> = {};
    return {
      headers,
      setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
      write: vi.fn(),
      end: vi.fn(),
    };
  }

  it('establece Content-Type application/pdf y Content-Disposition con filename correcto', async () => {
    const { controller } = setup();
    const res = makeRes();

    await controller.generarPdf(
      VALE_ID, {}, res as unknown as import('node:http').ServerResponse,
    ).catch(() => undefined); // stream.pipe may fail in test env — headers are set first

    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Content-Disposition']).toContain('attachment');
    expect(res.headers['Content-Disposition']).toContain('sm1-14-VA-T34-001-2026-08-26.pdf');
  });

  it('filename no contiene datos de paciente (INV-VA-009)', async () => {
    const { controller } = setup();
    const res = makeRes();

    await controller.generarPdf(
      VALE_ID, {}, res as unknown as import('node:http').ServerResponse,
    ).catch(() => undefined);

    const disposition = res.headers['Content-Disposition'] ?? '';
    expect(disposition).not.toMatch(/paciente/i);
    expect(disposition).not.toMatch(/curp/i);
    expect(disposition).not.toMatch(/folio/i);
  });

  it('400 con UUID inválido', async () => {
    const { controller } = setup();
    const res = makeRes();
    await expectProblem(
      controller.generarPdf('bad-id', {}, res as unknown as import('node:http').ServerResponse),
      400, 'HTTP_VALIDATION_ERROR',
    );
  });

  it('401 cuando el resolver rechaza autenticación', async () => {
    const { controller } = setup({ resolve: vi.fn().mockRejectedValue(new Error('no auth')) });
    const res = makeRes();
    await expectProblem(
      controller.generarPdf(VALE_ID, {}, res as unknown as import('node:http').ServerResponse),
      401, 'AUTHENTICATION_REQUIRED',
    );
  });

  it('403 cuando use case lanza PERMISSION_DENIED', async () => {
    const { controller, generarPdfVale } = setup();
    generarPdfVale.execute.mockRejectedValue(new ApplicationError('PERMISSION_DENIED', 'denied'));
    const res = makeRes();
    await expectProblem(
      controller.generarPdf(VALE_ID, {}, res as unknown as import('node:http').ServerResponse),
      403, 'PERMISSION_DENIED',
    );
  });

  it('404 cuando use case lanza VALE_ARCHIVO_NOT_FOUND', async () => {
    const { controller, generarPdfVale } = setup();
    generarPdfVale.execute.mockRejectedValue(new ApplicationError('VALE_ARCHIVO_NOT_FOUND', 'nf'));
    const res = makeRes();
    await expectProblem(
      controller.generarPdf(VALE_ID, {}, res as unknown as import('node:http').ServerResponse),
      404, 'VALE_ARCHIVO_NOT_FOUND',
    );
  });

  it('use case no se llama cuando UUID es inválido', async () => {
    const { controller, generarPdfVale } = setup();
    const res = makeRes();
    await controller.generarPdf('bad', {}, res as unknown as import('node:http').ServerResponse)
      .catch(() => undefined);
    expect(generarPdfVale.execute).not.toHaveBeenCalled();
  });
});

// ── Regresión T-BUG-VA-001: VALE_NUMERO_DUPLICADO ────────────────────────────

describe('crearVale — VALE_NUMERO_DUPLICADO (T-BUG-VA-001)', () => {
  it('409 VALE_NUMERO_DUPLICADO con body RFC7807 completo', async () => {
    const { controller, registrarVale } = setup();
    registrarVale.execute.mockRejectedValue(
      new ApplicationError('VALE_NUMERO_DUPLICADO', 'interno'),
    );
    const problem = await expectProblem(
      controller.crearVale(validBody, {}), 409, 'VALE_NUMERO_DUPLICADO',
    );
    expect(problem['type']).toBe('https://sigac/errors/vale-numero-duplicado');
    expect(problem['title']).toBe('Conflict');
    expect(problem['status']).toBe(409);
    // Internal message must not leak
    const json = JSON.stringify(problem);
    expect(json).not.toContain('interno');
  });

  it('409 — respuesta no expone detalles del constraint SQL', async () => {
    const { controller, registrarVale } = setup();
    // Simulate the concurrency path (DB constraint fires)
    const dbErr = new Error('VALE_NUMERO_DUPLICADO');
    dbErr.name = 'ValeNumeroDuplicadoError';
    registrarVale.execute.mockRejectedValue(dbErr);
    const problem = await expectProblem(
      controller.crearVale(validBody, {}), 409, 'VALE_NUMERO_DUPLICADO',
    );
    const json = JSON.stringify(problem);
    expect(json).not.toContain('vale_archivo_numero_vale_unique');
    expect(json).not.toContain('duplicate key');
  });
});
