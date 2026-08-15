import { DynamicModule, Module } from '@nestjs/common';
import { ApiProblemMapper } from './api-errors.js';
import {
  EXPEDIENTE_API_TOKENS,
  type ExpedienteApiModuleDependencies,
} from './expediente-api.contracts.js';
import { ExpedienteController } from './expediente.controller.js';

@Module({})
export class ExpedienteApiModule {
  static register(dependencies: ExpedienteApiModuleDependencies): DynamicModule {
    return {
      module: ExpedienteApiModule,
      controllers: [ExpedienteController],
      providers: [
        ApiProblemMapper,
        { provide: EXPEDIENTE_API_TOKENS.requestContextResolver, useValue: dependencies.requestContextResolver },
        { provide: EXPEDIENTE_API_TOKENS.getExpediente, useValue: dependencies.getExpediente },
        { provide: EXPEDIENTE_API_TOKENS.getExpedienteTimeline, useValue: dependencies.getExpedienteTimeline },
        { provide: EXPEDIENTE_API_TOKENS.searchExpedientesByNumero, useValue: dependencies.searchExpedientesByNumero },
        { provide: EXPEDIENTE_API_TOKENS.dispatchExpediente, useValue: dependencies.dispatchExpediente },
        { provide: EXPEDIENTE_API_TOKENS.acceptCustody, useValue: dependencies.acceptCustody },
      ],
    };
  }
}
