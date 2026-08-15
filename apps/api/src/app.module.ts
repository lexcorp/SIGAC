import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

@Module({
  // ExpedienteApiModule is mounted by the production composition task only when all
  // real authentication and projection providers are available. Never register fakes here.
  controllers: [HealthController],
})
export class AppModule {}
