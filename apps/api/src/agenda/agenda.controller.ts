import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type GetAgendaDaySummary,
  type GetAgendaImportIncidents,
  type GetAgendaImportResult,
  type GetAgendaPreparationList,
  type ImportAgenda,
  type ListAgendaImports,
  type PrintAgendaPreparationList,
} from '@sigac/agenda-preparation';
import { randomUUID } from 'node:crypto';
import {
  AgendaArtifactUnsupportedError,
  AgendaApiProblemMapper,
  AgendaUploadTooLargeError,
  AuthenticationRequiredError,
  HttpValidationError,
} from './agenda-api-errors.js';
import {
  AGENDA_API_TOKENS,
  AGENDA_UPLOAD_SIZE_LIMIT_KEY,
  type AuthenticatedRequestContextResolver,
} from './agenda-api.contracts.js';
import {
  parseAgendaDate,
  parseIdempotencyKey,
  parseImportacionId,
  parseOptionalAgendaDateFilter,
  parseOptionalCursor,
  parsePaginationLimit,
  parsePreparationOrder,
} from './agenda-http-validation.js';
import { toJsonValue } from '../expediente/json-serializer.js';

// ---------------------------------------------------------------------------
// Minimal multer file type — @types/multer is not installed in this project
// ---------------------------------------------------------------------------

interface MulterFile {
  fieldname: string;
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype?: string;
}

// Supported artifact extension
const SUPPORTED_EXTENSION = /\.xls$/i;

function readUploadLimit(): number {
  const raw = process.env[AGENDA_UPLOAD_SIZE_LIMIT_KEY];
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller()
export class AgendaController {
  private readonly uploadLimitBytes: number = readUploadLimit();

  constructor(
    @Inject(AGENDA_API_TOKENS.requestContextResolver)
    private readonly requestContextResolver: AuthenticatedRequestContextResolver,
    @Inject(AGENDA_API_TOKENS.importAgenda)
    private readonly importAgendaUseCase: ImportAgenda,
    @Inject(AGENDA_API_TOKENS.getAgendaImportResult)
    private readonly getAgendaImportResultUseCase: GetAgendaImportResult,
    @Inject(AGENDA_API_TOKENS.listAgendaImports)
    private readonly listAgendaImportsUseCase: ListAgendaImports,
    @Inject(AGENDA_API_TOKENS.getAgendaDaySummary)
    private readonly getAgendaDaySummaryUseCase: GetAgendaDaySummary,
    @Inject(AGENDA_API_TOKENS.getAgendaPreparationList)
    private readonly getAgendaPreparationListUseCase: GetAgendaPreparationList,
    @Inject(AGENDA_API_TOKENS.printAgendaPreparationList)
    private readonly printAgendaPreparationListUseCase: PrintAgendaPreparationList,
    @Inject(AGENDA_API_TOKENS.getAgendaImportIncidents)
    private readonly getAgendaImportIncidentsUseCase: GetAgendaImportIncidents,
    @Inject(AgendaApiProblemMapper)
    private readonly problemMapper: AgendaApiProblemMapper,
  ) {}

  // -------------------------------------------------------------------------
  // API-AP-002 — POST /api/v1/agenda-imports
  // multipart/form-data, field "file", header "Idempotency-Key"
  // -------------------------------------------------------------------------
  @Post('agenda-imports')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file'))
  async importAgenda(
    @UploadedFile() file: MulterFile | undefined,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Req() request: unknown,
  ): Promise<unknown> {
    // Generate ImportAttemptId BEFORE any validation (API-AP-005)
    const importAttemptId = randomUUID();

    return this.executeImport(importAttemptId, async () => {
      // Validate multipart envelope
      if (!file || file.size === 0) {
        throw new HttpValidationError('file', 'REQUIRED');
      }

      // Validate Idempotency-Key header (API-AP-009)
      const idempotencyKey = parseIdempotencyKey(idempotencyKeyHeader);

      // Extension check — fast rejection before content inspection (API-AP-003)
      const originalName = file.originalname ?? '';
      if (originalName && !SUPPORTED_EXTENSION.test(originalName)) {
        throw new AgendaArtifactUnsupportedError();
      }

      // Upload size limit (API-AP-004)
      if (this.uploadLimitBytes > 0 && file.size > this.uploadLimitBytes) {
        throw new AgendaUploadTooLargeError();
      }

      // Resolve RequestContext — authorization enforced inside the use case
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });

      // Wrap buffered bytes in the AgendaFileInput streaming interface
      const fileBytes = file.buffer;
      const agendaFileInput = {
        sizeBytes: fileBytes.length,
        open: async function* () {
          yield new Uint8Array(fileBytes);
        },
      };

      const result = await this.importAgendaUseCase.execute({
        importAttemptId,
        idempotencyKey,
        file: agendaFileInput,
        context,
      });

      // API-AP-008: response includes importedAt (server timestamp, not from artifact)
      return toJsonValue({
        importacionId: result.importacionId,
        agendaDate: result.agendaDate,
        importedAt: new Date().toISOString(),
        outcome: result.outcome,
        metrics: result.metrics,
      });
    });
  }

  // -------------------------------------------------------------------------
  // API-AP-011 — GET /api/v1/agenda-imports?agendaDate=&cursor=&limit=
  // -------------------------------------------------------------------------
  @Get('agenda-imports')
  async listAgendaImports(
    @Query('agendaDate') agendaDate: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() request: unknown,
  ): Promise<unknown> {
    return this.executeQuery(async () => {
      const parsedAgendaDate = parseOptionalAgendaDateFilter(agendaDate);
      const parsedCursor = parseOptionalCursor(cursor);
      const parsedLimit = parsePaginationLimit(limit);
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });
      const result = await this.listAgendaImportsUseCase.execute({
        agendaDate: parsedAgendaDate,
        pagination: { cursor: parsedCursor, limit: parsedLimit },
        context,
      });
      return toJsonValue(result);
    });
  }

  // -------------------------------------------------------------------------
  // API-AP-011 — GET /api/v1/agenda-imports/:id
  // -------------------------------------------------------------------------
  @Get('agenda-imports/:id')
  async getAgendaImportResult(
    @Param('id') id: string,
    @Req() request: unknown,
  ): Promise<unknown> {
    return this.executeQuery(async () => {
      const importacionId = parseImportacionId(id);
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });
      const result = await this.getAgendaImportResultUseCase.execute({ importacionId, context });
      return toJsonValue(result);
    });
  }

  // -------------------------------------------------------------------------
  // API-AP-011 — GET /api/v1/agenda-imports/:id/incidents?cursor=&limit=
  // -------------------------------------------------------------------------
  @Get('agenda-imports/:id/incidents')
  async getAgendaImportIncidents(
    @Param('id') id: string,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() request: unknown,
  ): Promise<unknown> {
    return this.executeQuery(async () => {
      const importacionId = parseImportacionId(id);
      const parsedCursor = parseOptionalCursor(cursor);
      const parsedLimit = parsePaginationLimit(limit);
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });
      const incidents = await this.getAgendaImportIncidentsUseCase.execute({
        importacionId,
        context,
      });
      // Port returns flat array; apply cursor-based pagination at boundary
      const start = parsedCursor !== undefined ? (parseInt(parsedCursor, 10) || 0) : 0;
      const items = incidents.slice(start, start + parsedLimit);
      const nextCursor =
        start + parsedLimit < incidents.length ? String(start + parsedLimit) : null;
      return toJsonValue({ items, nextCursor });
    });
  }

  // -------------------------------------------------------------------------
  // API-AP-011 — GET /api/v1/agendas/:date
  // -------------------------------------------------------------------------
  @Get('agendas/:date')
  async getAgendaDaySummary(
    @Param('date') date: string,
    @Req() request: unknown,
  ): Promise<unknown> {
    return this.executeQuery(async () => {
      const agendaDate = parseAgendaDate(date);
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });
      const result = await this.getAgendaDaySummaryUseCase.execute({ agendaDate, context });
      return toJsonValue(result);
    });
  }

  // -------------------------------------------------------------------------
  // API-AP-011/012 — GET /api/v1/agendas/:date/preparation-items/print?order=
  // Must come before the paginated route to avoid NestJS routing ambiguity
  // -------------------------------------------------------------------------
  @Get('agendas/:date/preparation-items/print')
  async printAgendaPreparationList(
    @Param('date') date: string,
    @Query('order') order: string | undefined,
    @Req() request: unknown,
  ): Promise<unknown> {
    return this.executeQuery(async () => {
      const agendaDate = parseAgendaDate(date);
      const parsedOrder = parsePreparationOrder(order);
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });
      const items = await this.printAgendaPreparationListUseCase.execute({
        agendaDate,
        order: parsedOrder,
        context,
      });
      return toJsonValue({ items });
    });
  }

  // -------------------------------------------------------------------------
  // API-AP-011/012 — GET /api/v1/agendas/:date/preparation-items?order=&cursor=&limit=
  // -------------------------------------------------------------------------
  @Get('agendas/:date/preparation-items')
  async getAgendaPreparationList(
    @Param('date') date: string,
    @Query('order') order: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() request: unknown,
  ): Promise<unknown> {
    return this.executeQuery(async () => {
      const agendaDate = parseAgendaDate(date);
      const parsedOrder = parsePreparationOrder(order);
      const parsedCursor = parseOptionalCursor(cursor);
      const parsedLimit = parsePaginationLimit(limit);
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });
      const result = await this.getAgendaPreparationListUseCase.execute({
        agendaDate,
        order: parsedOrder,
        pagination: { cursor: parsedCursor, limit: parsedLimit },
        context,
      });
      return toJsonValue(result);
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async executeImport<T>(importAttemptId: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const exception = this.problemMapper.toHttpException(error, importAttemptId);
      if (exception !== null) throw exception;
      // Unexpected technical failure — sanitise (no internal disclosure)
      throw new HttpException(
        {
          type: 'https://sigac/errors/agenda-import-failed',
          title: 'Internal Server Error',
          status: 500,
          code: 'AGENDA_IMPORT_FAILED',
          importAttemptId,
        },
        500,
      );
    }
  }

  private async executeQuery<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const exception = this.problemMapper.toHttpException(error);
      if (exception !== null) throw exception;
      throw error;
    }
  }
}
