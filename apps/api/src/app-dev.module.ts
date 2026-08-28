/**
 * app-dev.module.ts
 *
 * NestJS module for the development / DEMO environment.
 *
 * Imports ExpedienteApiModule and AgendaApiModule wired with real Postgres
 * adapters and the dev cookie-based resolver. This module is only loaded
 * by main.ts when NODE_ENV !== 'production'.
 *
 * AppModule (production) continues to mount only HealthController until a
 * real OIDC/JWT AuthenticatedRequestContextResolver is available.
 */

import { Module, type DynamicModule, type OnModuleDestroy } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import {
  buildDemoRouter,
  buildExpedienteApiModule,
  buildAgendaApiModule,
  buildValeArchivoApiModule,
} from './dev-composition-root.js';
import { TenantDatabaseRouter } from '@sigac/database';

@Module({})
export class AppDevModule implements OnModuleDestroy {
  private static router: TenantDatabaseRouter | null = null;

  static register(): DynamicModule {
    const router = buildDemoRouter();
    AppDevModule.router = router;

    return {
      module: AppDevModule,
      controllers: [HealthController],
      imports: [
        buildExpedienteApiModule(router),
        buildAgendaApiModule(router),
        buildValeArchivoApiModule(router),
      ],
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (AppDevModule.router) {
      await AppDevModule.router.close();
      AppDevModule.router = null;
    }
  }
}
