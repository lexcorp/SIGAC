import { Controller, Get, Inject, Req } from '@nestjs/common';
import type { GetSessionAuthorization, ListUbicaciones } from '@sigac/archive-operations';
import { ApiProblemMapper } from './api-errors.js';
import { EXPEDIENTE_API_TOKENS, type AuthenticatedRequestContextResolver } from './expediente-api.contracts.js';

@Controller('session')
export class SessionController {
  constructor(
    @Inject(EXPEDIENTE_API_TOKENS.requestContextResolver) private readonly resolver: AuthenticatedRequestContextResolver,
    @Inject(EXPEDIENTE_API_TOKENS.getSessionAuthorization) private readonly useCase: GetSessionAuthorization,
    @Inject(ApiProblemMapper) private readonly mapper: ApiProblemMapper,
  ) {}

  @Get()
  async get(@Req() request: unknown): Promise<unknown> {
    try {
      const context = await this.resolver.resolve({ nativeRequest: request });
      return this.useCase.execute({ context });
    } catch (error) {
      const mapped = this.mapper.toHttpException(error); if (mapped) throw mapped; throw error;
    }
  }
}

@Controller('ubicaciones')
export class UbicacionesController {
  constructor(
    @Inject(EXPEDIENTE_API_TOKENS.requestContextResolver) private readonly resolver: AuthenticatedRequestContextResolver,
    @Inject(EXPEDIENTE_API_TOKENS.listUbicaciones) private readonly useCase: ListUbicaciones,
    @Inject(ApiProblemMapper) private readonly mapper: ApiProblemMapper,
  ) {}

  @Get()
  async list(@Req() request: unknown): Promise<unknown> {
    try {
      const context = await this.resolver.resolve({ nativeRequest: request });
      return { items: await this.useCase.execute({ context }) };
    } catch (error) {
      const mapped = this.mapper.toHttpException(error); if (mapped) throw mapped; throw error;
    }
  }
}
