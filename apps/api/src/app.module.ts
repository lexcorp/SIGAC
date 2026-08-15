import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { ExpedientesController } from './modules/expedientes.controller.js';

@Module({
  controllers: [HealthController, ExpedientesController],
})
export class AppModule {}
