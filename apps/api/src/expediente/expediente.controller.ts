import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ExpedienteId,
  Ubicacion,
  type AcceptCustody,
  type DispatchExpediente,
  type GetExpediente,
  type GetExpedienteTimeline,
  type SearchExpedientesByNumero,
} from '@sigac/archive-operations';
import { ApiProblemMapper } from './api-errors.js';
import {
  EXPEDIENTE_API_TOKENS,
  type AuthenticatedRequestContextResolver,
} from './expediente-api.contracts.js';
import {
  acceptCustodyBodySchema,
  dispatchBodySchema,
  parseHttp,
  parseExpedienteNumero,
  parseTimelineLimit,
  parseUuid,
} from './http-validation.js';
import { toJsonValue } from './json-serializer.js';

@Controller('expedientes')
export class ExpedienteController {
  constructor(
    @Inject(EXPEDIENTE_API_TOKENS.requestContextResolver)
    private readonly requestContextResolver: AuthenticatedRequestContextResolver,
    @Inject(EXPEDIENTE_API_TOKENS.getExpediente)
    private readonly getExpedienteUseCase: GetExpediente,
    @Inject(EXPEDIENTE_API_TOKENS.getExpedienteTimeline)
    private readonly getExpedienteTimelineUseCase: GetExpedienteTimeline,
    @Inject(EXPEDIENTE_API_TOKENS.searchExpedientesByNumero)
    private readonly searchExpedientesByNumeroUseCase: SearchExpedientesByNumero,
    @Inject(EXPEDIENTE_API_TOKENS.dispatchExpediente)
    private readonly dispatchExpedienteUseCase: DispatchExpediente,
    @Inject(EXPEDIENTE_API_TOKENS.acceptCustody)
    private readonly acceptCustodyUseCase: AcceptCustody,
    private readonly problemMapper: ApiProblemMapper,
  ) {}

  @Get()
  async search(
    @Query('numero') numero: string | undefined,
    @Req() request: unknown,
  ): Promise<unknown> {
    return this.execute(async () => {
      const parsedNumero = parseExpedienteNumero(numero);
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });
      const items = await this.searchExpedientesByNumeroUseCase.execute({
        numero: parsedNumero,
        context,
      });
      return toJsonValue({ items });
    });
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() request: unknown): Promise<unknown> {
    return this.execute(async () => {
      const expedienteId = ExpedienteId.parse(parseUuid(id));
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });
      const result = await this.getExpedienteUseCase.execute({ expedienteId, context });
      return toJsonValue(result);
    });
  }

  @Get(':id/timeline')
  async getTimeline(
    @Param('id') id: string,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() request: unknown,
  ): Promise<unknown> {
    return this.execute(async () => {
      const expedienteId = ExpedienteId.parse(parseUuid(id));
      const pagination = {
        ...(cursor === undefined ? {} : { cursor }),
        limit: parseTimelineLimit(limit),
      };
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });
      const result = await this.getExpedienteTimelineUseCase.execute({
        expedienteId,
        pagination,
        context,
      });
      return toJsonValue(result);
    });
  }

  @Post(':id/dispatch')
  @HttpCode(204)
  async dispatch(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @Req() request: unknown,
  ): Promise<void> {
    await this.execute(async () => {
      const expedienteId = ExpedienteId.parse(parseUuid(id));
      const body = parseHttp(dispatchBodySchema, rawBody);
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });
      await this.dispatchExpedienteUseCase.execute({
        expedienteId,
        destination: Ubicacion.create(body.destination),
        intendedCustodian: body.intendedCustodian,
        businessReference: body.businessReference,
        expectedRowVersion: BigInt(body.expectedRowVersion),
        context,
      });
    });
  }

  @Post(':id/accept-custody')
  @HttpCode(204)
  async acceptCustody(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @Req() request: unknown,
  ): Promise<void> {
    await this.execute(async () => {
      const expedienteId = ExpedienteId.parse(parseUuid(id));
      const body = parseHttp(acceptCustodyBodySchema, rawBody);
      const context = await this.requestContextResolver.resolve({ nativeRequest: request });
      await this.acceptCustodyUseCase.execute({
        expedienteId,
        receptor: body.receptor,
        ubicacionDestino: Ubicacion.create(body.ubicacionDestino),
        businessReference: body.businessReference,
        expectedRowVersion: BigInt(body.expectedRowVersion),
        context,
      });
    });
  }

  private async execute<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const exception = this.problemMapper.toHttpException(error);
      if (exception) throw exception;
      throw error;
    }
  }
}
