import { DynamicModule, Module } from '@nestjs/common';
import { AgendaApiProblemMapper } from './agenda-api-errors.js';
import {
  AGENDA_API_TOKENS,
  type AgendaApiModuleDependencies,
} from './agenda-api.contracts.js';
import { AgendaController } from './agenda.controller.js';

@Module({})
export class AgendaApiModule {
  static register(dependencies: AgendaApiModuleDependencies): DynamicModule {
    return {
      module: AgendaApiModule,
      controllers: [AgendaController],
      providers: [
        AgendaApiProblemMapper,
        { provide: AGENDA_API_TOKENS.requestContextResolver, useValue: dependencies.requestContextResolver },
        { provide: AGENDA_API_TOKENS.importAgenda, useValue: dependencies.importAgenda },
        { provide: AGENDA_API_TOKENS.getAgendaImportResult, useValue: dependencies.getAgendaImportResult },
        { provide: AGENDA_API_TOKENS.listAgendaImports, useValue: dependencies.listAgendaImports },
        { provide: AGENDA_API_TOKENS.getAgendaDaySummary, useValue: dependencies.getAgendaDaySummary },
        { provide: AGENDA_API_TOKENS.getAgendaPreparationList, useValue: dependencies.getAgendaPreparationList },
        { provide: AGENDA_API_TOKENS.printAgendaPreparationList, useValue: dependencies.printAgendaPreparationList },
        { provide: AGENDA_API_TOKENS.getAgendaImportIncidents, useValue: dependencies.getAgendaImportIncidents },
      ],
    };
  }
}
