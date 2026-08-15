import { DynamicModule, Module } from '@nestjs/common';
import { ApiProblemMapper } from './api-errors.js';
import {
  EXPEDIENTE_API_TOKENS,
  type ExpedienteApiModuleDependencies,
} from './expediente-api.contracts.js';
import { ExpedienteController } from './expediente.controller.js';
import { SessionController, UbicacionesController } from './support.controller.js';

@Module({})
export class ExpedienteApiModule {
  static register(dependencies: ExpedienteApiModuleDependencies): DynamicModule {
    return {
      module: ExpedienteApiModule,
      controllers: [ExpedienteController, SessionController, UbicacionesController],
      providers: [
        ApiProblemMapper,
        { provide: EXPEDIENTE_API_TOKENS.requestContextResolver, useValue: dependencies.requestContextResolver },
        { provide: EXPEDIENTE_API_TOKENS.getExpediente, useValue: dependencies.getExpediente },
        { provide: EXPEDIENTE_API_TOKENS.getExpedienteTimeline, useValue: dependencies.getExpedienteTimeline },
        { provide: EXPEDIENTE_API_TOKENS.getExpedienteAudit, useValue: dependencies.getExpedienteAudit },
        { provide: EXPEDIENTE_API_TOKENS.getSessionAuthorization, useValue: dependencies.getSessionAuthorization },
        { provide: EXPEDIENTE_API_TOKENS.listUbicaciones, useValue: dependencies.listUbicaciones },
        { provide: EXPEDIENTE_API_TOKENS.searchExpedientesByNumero, useValue: dependencies.searchExpedientesByNumero },
        { provide: EXPEDIENTE_API_TOKENS.dispatchExpediente, useValue: dependencies.dispatchExpediente },
        { provide: EXPEDIENTE_API_TOKENS.acceptCustody, useValue: dependencies.acceptCustody },
      ],
    };
  }
}
