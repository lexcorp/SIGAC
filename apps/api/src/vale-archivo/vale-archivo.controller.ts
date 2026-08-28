/**
 * ValeArchivoController — HTTP boundary para Vale Archivo.
 *
 * 7 endpoints orientados a comandos de dominio:
 *   POST   /vale-archivo                            VA-001 crear
 *   GET    /vale-archivo                            VA-003 listar
 *   GET    /vale-archivo/:id                        VA-003 detalle
 *   POST   /vale-archivo/:id/iniciar-busqueda       VA-004
 *   PATCH  /vale-archivo/:id/items/:itemId          VA-005 localización
 *   POST   /vale-archivo/:id/entrega                VA-006
 *   POST   /vale-archivo/:id/cerrar                 VA-007
 *   GET    /vale-archivo/:id/pdf                  VA-002
 *
 * Reglas:
 *   - Sin lógica de negocio; delega a use cases.
 *   - TenantContext y permisos provienen exclusivamente del RequestContextResolver.
 *   - Todos los errores → RFC 7807 vía ValeArchivoApiProblemMapper.
 */
import {
  Body, Controller, Get, HttpCode, HttpException,
  Inject, Param, Patch, Post, Query, Req, Res,
} from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import type {
  CerrarValeAdministrativo,
  ConsultarVale,
  GenerarPdfVale,
  IniciarBusqueda,
  ListarVales,
  RegistrarEntrega,
  RegistrarLocalizacion,
  RegistrarVale,
  RegistrarValeItemInput,
} from '@sigac/vale-archivo';
import type { EstadoVale } from '@sigac/vale-archivo';
import {
  VALE_ARCHIVO_API_TOKENS,
  type AuthenticatedRequestContextResolver,
} from './vale-archivo-api.contracts.js';
import {
  ValeArchivoApiProblemMapper,
  ValeArchivoAuthenticationRequiredError,
  ValeArchivoHttpValidationError,
} from './vale-archivo-api-errors.js';

// ── Validation helpers ────────────────────────────────────────────────────────

const VALID_ESTADOS: readonly string[] = [
  'RECIBIDA', 'EN_BUSQUEDA', 'COMPLETA', 'PARCIAL',
  'NO_LOCALIZADA', 'ENTREGADA', 'CERRADA',
];
const VALID_ESTADO_BUSQUEDA: readonly string[] = ['LOCALIZADO', 'NO_LOCALIZADO'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE  = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function req(v: unknown, f: string): string {
  if (typeof v !== 'string' || v.trim() === '')
    throw new ValeArchivoHttpValidationError(f, 'REQUIRED');
  return v.trim();
}

function uuid(v: string, f: string): string {
  if (!UUID_RE.test(v)) throw new ValeArchivoHttpValidationError(f, 'INVALID_FORMAT');
  return v;
}

function optEstado(raw: unknown): EstadoVale | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (!VALID_ESTADOS.includes(String(raw)))
    throw new ValeArchivoHttpValidationError('estado', 'INVALID_FORMAT');
  return raw as EstadoVale;
}

function optDate(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (!ISO_DATE.test(String(raw)))
    throw new ValeArchivoHttpValidationError('fecha', 'INVALID_FORMAT');
  return String(raw);
}

function optLimit(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1 || n > 100)
    throw new ValeArchivoHttpValidationError('limit', 'INVALID_FORMAT');
  return n;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller()
export class ValeArchivoController {
  constructor(
    @Inject(VALE_ARCHIVO_API_TOKENS.requestContextResolver)
    private readonly resolver: AuthenticatedRequestContextResolver,
    @Inject(VALE_ARCHIVO_API_TOKENS.registrarVale)
    private readonly registrarValeUC: RegistrarVale,
    @Inject(VALE_ARCHIVO_API_TOKENS.consultarVale)
    private readonly consultarValeUC: ConsultarVale,
    @Inject(VALE_ARCHIVO_API_TOKENS.listarVales)
    private readonly listarValesUC: ListarVales,
    @Inject(VALE_ARCHIVO_API_TOKENS.iniciarBusqueda)
    private readonly iniciarBusquedaUC: IniciarBusqueda,
    @Inject(VALE_ARCHIVO_API_TOKENS.registrarLocalizacion)
    private readonly registrarLocalizacionUC: RegistrarLocalizacion,
    @Inject(VALE_ARCHIVO_API_TOKENS.registrarEntrega)
    private readonly registrarEntregaUC: RegistrarEntrega,
    @Inject(VALE_ARCHIVO_API_TOKENS.cerrarValeAdministrativo)
    private readonly cerrarValeUC: CerrarValeAdministrativo,
    @Inject(VALE_ARCHIVO_API_TOKENS.generarPdfVale)
    private readonly generarPdfValeUC: GenerarPdfVale,
    @Inject(ValeArchivoApiProblemMapper)
    private readonly mapper: ValeArchivoApiProblemMapper,
  ) {}

  // ── POST /vale-archivo — VA-001 ─────────────────────────────────────────
  @Post('vale-archivo')
  @HttpCode(201)
  async crearVale(@Body() body: unknown, @Req() request: unknown): Promise<unknown> {
    return this.run(async () => {
      const context = await this.ctx(request);
      const b = body as Record<string, unknown>;
      const rawItems = Array.isArray(b['items']) ? (b['items'] as unknown[]) : [];
      if (rawItems.length === 0)
        throw new ValeArchivoHttpValidationError('items', 'REQUIRED');

      const items: RegistrarValeItemInput[] = rawItems.map((raw, idx) => {
        const i = raw as Record<string, unknown>;
        return {
          expedienteNumero: req(i['expedienteNumero'], `items[${idx}].expedienteNumero`),
          pacienteNombre:   req(i['pacienteNombre'],   `items[${idx}].pacienteNombre`),
          especialidad:     req(i['especialidad'],      `items[${idx}].especialidad`),
        };
      });

      const r = await this.registrarValeUC.execute({
        numeroVale:        req(b['numeroVale'],        'numeroVale'),
        fechaSolicitud:    req(b['fechaSolicitud'],    'fechaSolicitud'),
        fechaRecepcion:    req(b['fechaRecepcion'],    'fechaRecepcion'),
        unidadSolicitante: req(b['unidadSolicitante'], 'unidadSolicitante'),
        solicitanteNombre: req(b['solicitanteNombre'], 'solicitanteNombre'),
        solicitanteCargo:  req(b['solicitanteCargo'],  'solicitanteCargo'),
        autorizadorNombre: req(b['autorizadorNombre'], 'autorizadorNombre'),
        autorizadorCargo:  req(b['autorizadorCargo'],  'autorizadorCargo'),
        items,
        context,
      });
      return { id: r.id, numeroVale: r.numeroVale, estado: r.estado };
    });
  }

  // ── GET /vale-archivo — VA-003 lista ────────────────────────────────────
  @Get('vale-archivo')
  async listarVales(
    @Query('estado') estado: unknown, @Query('fecha') fecha: unknown,
    @Query('unidad') unidad: unknown, @Query('cursor') cursor: string | undefined,
    @Query('limit')  limit:  unknown, @Req() request: unknown,
  ): Promise<unknown> {
    return this.run(async () => {
      const context = await this.ctx(request);
      const r = await this.listarValesUC.execute({
        estado: optEstado(estado), fecha: optDate(fecha),
        unidad: unidad ? String(unidad) : undefined,
        cursor: cursor || undefined, limit: optLimit(limit),
        context,
      });
      return {
        items: r.items.map((i) => ({
          id: i.id, numeroVale: i.numeroVale,
          fechaSolicitud: i.fechaSolicitud,
          unidadSolicitante: i.unidadSolicitante,
          solicitanteNombre: i.solicitanteNombre,
          estado: i.estado, itemCount: i.itemCount,
        })),
        nextCursor: r.nextCursor,
      };
    });
  }

  // ── GET /vale-archivo/:id — VA-003 detalle ──────────────────────────────
  @Get('vale-archivo/:id')
  async consultarVale(@Param('id') id: string, @Req() request: unknown): Promise<unknown> {
    return this.run(async () => {
      uuid(id, 'id');
      const context = await this.ctx(request);
      const s = await this.consultarValeUC.execute({ valeId: id, context });
      return {
        id: s.id, numeroVale: s.numeroVale,
        fechaSolicitud: s.fechaSolicitud, fechaRecepcion: s.fechaRecepcion,
        unidadSolicitante: s.unidadSolicitante,
        solicitante: s.solicitante, autorizador: s.autorizador,
        estado: s.estado, creadoPor: s.creadoPor,
        busquedaIniciadaPor: s.busquedaIniciadaPor,
        busquedaIniciadaAt: s.busquedaIniciadaAt,
        entregadoPor: s.entregadoPor, entregadoAt: s.entregadoAt,
        receptorEntrega: s.receptorEntrega,
        createdAt: s.createdAt, updatedAt: s.updatedAt,
        items: s.items.map((item) => ({
          id: item.id, expedienteNumero: item.expedienteNumero,
          pacienteNombre: item.pacienteNombre, especialidad: item.especialidad,
          estadoBusqueda: item.estadoBusqueda,
          ubicacionEncontrada: item.ubicacionEncontrada,
          observaciones: item.observaciones,
        })),
      };
    });
  }

  // ── POST /vale-archivo/:id/iniciar-busqueda — VA-004 ────────────────────
  @Post('vale-archivo/:id/iniciar-busqueda')
  @HttpCode(200)
  async iniciarBusqueda(@Param('id') id: string, @Req() request: unknown): Promise<void> {
    await this.run(async () => {
      uuid(id, 'id');
      const context = await this.ctx(request);
      await this.iniciarBusquedaUC.execute({ valeId: id, context });
      return undefined;
    });
  }

  // ── PATCH /vale-archivo/:id/items/:itemId — VA-005 ──────────────────────
  @Patch('vale-archivo/:id/items/:itemId')
  @HttpCode(200)
  async registrarLocalizacion(
    @Param('id')     id:     string,
    @Param('itemId') itemId: string,
    @Body()          body:   unknown,
    @Req()           request: unknown,
  ): Promise<void> {
    await this.run(async () => {
      uuid(id,     'id');
      uuid(itemId, 'itemId');
      const context = await this.ctx(request);
      const b = body as Record<string, unknown>;

      const rawEstado = b['estadoBusqueda'];
      if (!VALID_ESTADO_BUSQUEDA.includes(String(rawEstado)))
        throw new ValeArchivoHttpValidationError('estadoBusqueda', 'INVALID_FORMAT');

      await this.registrarLocalizacionUC.execute({
        valeId:   id,
        itemId,
        estadoBusqueda:      rawEstado as 'LOCALIZADO' | 'NO_LOCALIZADO',
        ubicacionEncontrada: typeof b['ubicacionEncontrada'] === 'string' ? b['ubicacionEncontrada'] : undefined,
        observaciones:       typeof b['observaciones']       === 'string' ? b['observaciones']       : undefined,
        context,
      });
      return undefined;
    });
  }

  // ── POST /vale-archivo/:id/entrega — VA-006 ─────────────────────────────
  @Post('vale-archivo/:id/entrega')
  @HttpCode(200)
  async registrarEntrega(@Param('id') id: string, @Body() body: unknown, @Req() request: unknown): Promise<void> {
    await this.run(async () => {
      uuid(id, 'id');
      const context = await this.ctx(request);
      const b = body as Record<string, unknown>;
      const itemsEntregados = Array.isArray(b['itemsEntregados'])
        ? (b['itemsEntregados'] as string[])
        : [];

      await this.registrarEntregaUC.execute({
        valeId:          id,
        receptorEntrega: req(b['receptorEntrega'], 'receptorEntrega'),
        entregadoAt:     req(b['entregadoAt'],     'entregadoAt'),
        itemsEntregados,
        context,
      });
      return undefined;
    });
  }

  // ── POST /vale-archivo/:id/cerrar — VA-007 ──────────────────────────────
  @Post('vale-archivo/:id/cerrar')
  @HttpCode(200)
  async cerrarVale(@Param('id') id: string, @Body() body: unknown, @Req() request: unknown): Promise<void> {
    await this.run(async () => {
      uuid(id, 'id');
      const context = await this.ctx(request);
      const b = body as Record<string, unknown>;
      await this.cerrarValeUC.execute({
        valeId:  id,
        motivo:  typeof b['motivo'] === 'string' ? b['motivo'] : undefined,
        context,
      });
      return undefined;
    });
  }

  // ── GET /vale-archivo/:id/pdf — VA-002 ─────────────────────────────────
  /**
   * Genera y descarga el PDF SM 1-14 del vale.
   * Permiso requerido: ARCHIVE_REQUEST_VIEW o REQUEST_CREATE (ADR-0033).
   * PDF generado en memoria — no persiste en filesystem (INV-VA-008).
   * filename = sm1-14-{numeroVale}-{YYYY-MM-DD}.pdf (INV-VA-009).
   */
  @Get('vale-archivo/:id/pdf')
  async generarPdf(
    @Param('id') id: string,
    @Req()       request: unknown,
    @Res()       res: ServerResponse,
  ): Promise<void> {
    const mapper = this.mapper;
    try {
      uuid(id, 'id');
      const context = await this.ctx(request);
      const result = await this.generarPdfValeUC.execute({ valeId: id, context });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      (result.stream as import('node:stream').Readable).pipe(res as import('node:stream').Writable);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const mapped = mapper.toHttpException(error);
      if (mapped !== null) throw mapped;
      throw new HttpException(
        { type: 'https://sigac/errors/internal', title: 'Internal Server Error', status: 500, code: 'INTERNAL_ERROR' },
        500,
      );
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async ctx(request: unknown) {
    try {
      return await this.resolver.resolve({ nativeRequest: request });
    } catch {
      throw new ValeArchivoAuthenticationRequiredError();
    }
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const mapped = this.mapper.toHttpException(error);
      if (mapped !== null) throw mapped;
      throw new HttpException(
        { type: 'https://sigac/errors/internal', title: 'Internal Server Error', status: 500, code: 'INTERNAL_ERROR' },
        500,
      );
    }
  }
}
