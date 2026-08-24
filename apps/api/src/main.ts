import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppDevModule } from './app-dev.module.js';

async function bootstrap() {
  // Production module mounts only HealthController until a real OIDC/JWT
  // AuthenticatedRequestContextResolver is available and configured.
  // In development/demo, AppDevModule wires the full API with real Postgres
  // adapters and the cookie-based dev actor resolver.
  const isProduction = process.env['NODE_ENV'] === 'production';
  const rootModule = isProduction ? AppModule : AppDevModule.register();

  const app = await NestFactory.create(rootModule);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  await app.listen(Number(process.env['API_PORT'] ?? 3000));
}
void bootstrap();
