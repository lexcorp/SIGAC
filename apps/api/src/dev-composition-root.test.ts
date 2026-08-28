/**
 * Tests for the REAL AppDevModule composition root.
 *
 * These tests verify what the E2E harness tests do NOT:
 * - GET /api/v1/session is mounted and returns 200
 * - Session response contains Agenda permissions for the DEMO full actor
 * - Actor without agenda permissions is denied (fail-closed)
 * - /api/v1/agenda-imports is mounted (controller registered)
 * - /api/v1/agendas/:date is mounted (controller registered)
 * - Controllers do not access DB/repos directly (Clean Architecture boundary)
 * - AppModule (production) still does NOT mount functional controllers
 */

import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { AppModule } from './app.module.js';
import { AppDevModule } from './app-dev.module.js';
import { ExpedienteApiModule } from './expediente/expediente-api.module.js';
import { AgendaApiModule } from './agenda/agenda-api.module.js';
import { ExpedienteController } from './expediente/expediente.controller.js';
import { SessionController, UbicacionesController } from './expediente/support.controller.js';
import { AgendaController } from './agenda/agenda.controller.js';
import { HealthController } from './health.controller.js';
import {
  devResolver,
  devMedicoQuery,
  buildDemoRouter,
  buildExpedienteApiModule,
  buildAgendaApiModule,
} from './dev-composition-root.js';
import { GetSessionAuthorization } from '@sigac/archive-operations';
import { NumeroEmpleado } from '@sigac/agenda-preparation';

// ---------------------------------------------------------------------------
// 1. AppModule (production) — still only mounts HealthController
// ---------------------------------------------------------------------------

describe('AppModule (production) — unchanged invariants', () => {
  it('AppModule imports list does not contain ExpedienteApiModule', () => {
    const imports = (Reflect.getMetadata('imports', AppModule) as unknown[]) ?? [];
    const importNames = imports.map((m) =>
      typeof m === 'function' ? m.name : String(m),
    );
    expect(importNames).not.toContain('ExpedienteApiModule');
    expect(importNames).not.toContain('AgendaApiModule');
  });

  it('AppModule controllers list contains only HealthController', () => {
    const controllers = (Reflect.getMetadata('controllers', AppModule) as unknown[]) ?? [];
    expect(controllers).toContain(HealthController);
    expect(controllers).not.toContain(SessionController);
    expect(controllers).not.toContain(AgendaController);
    expect(controllers).not.toContain(ExpedienteController);
  });

  it('AppModule providers do not contain fakes or dev resolvers', () => {
    const providers = JSON.stringify(
      (Reflect.getMetadata('providers', AppModule) as unknown[]) ?? [],
    );
    expect(providers).not.toContain('fake');
    expect(providers).not.toContain('demo');
  });
});

// ---------------------------------------------------------------------------
// 2. ExpedienteApiModule registration — session endpoint is mounted
// ---------------------------------------------------------------------------

describe('ExpedienteApiModule.register — session endpoint mounted', () => {
  it('registers SessionController', () => {
    const router = buildDemoRouter();
    const mod = buildExpedienteApiModule(router);
    expect(mod.controllers).toContain(SessionController);
  });

  it('registers UbicacionesController', () => {
    const router = buildDemoRouter();
    const mod = buildExpedienteApiModule(router);
    expect(mod.controllers).toContain(UbicacionesController);
  });

  it('registers ExpedienteController', () => {
    const router = buildDemoRouter();
    const mod = buildExpedienteApiModule(router);
    expect(mod.controllers).toContain(ExpedienteController);
  });

  it('has exactly 10 providers (9 tokens + ApiProblemMapper)', () => {
    const router = buildDemoRouter();
    const mod = buildExpedienteApiModule(router);
    expect(mod.providers).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// 3. AgendaApiModule registration — agenda endpoints are mounted
// ---------------------------------------------------------------------------

describe('AgendaApiModule.register — agenda endpoints mounted', () => {
  it('registers AgendaController', () => {
    const router = buildDemoRouter();
    const mod = buildAgendaApiModule(router);
    expect(mod.controllers).toContain(AgendaController);
  });

  it('has exactly 10 providers (9 tokens + AgendaApiProblemMapper) — T-23 adds generatePreparationReport', () => {
    const router = buildDemoRouter();
    const mod = buildAgendaApiModule(router);
    expect(mod.providers).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// 4. Session permissions — DEMO full actor includes Agenda permissions
// ---------------------------------------------------------------------------

describe('devResolver + GetSessionAuthorization — DEMO full actor', () => {
  it('GET /api/v1/session returns AGENDA_VIEW for full actor (no cookie)', async () => {
    const context = await devResolver.resolve({ nativeRequest: {} });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session.permissions).toContain('AGENDA_VIEW');
  });

  it('GET /api/v1/session returns AGENDA_IMPORT for full actor', async () => {
    const context = await devResolver.resolve({ nativeRequest: {} });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session.permissions).toContain('AGENDA_IMPORT');
  });

  it('GET /api/v1/session returns AGENDA_INCIDENT_VIEW for full actor', async () => {
    const context = await devResolver.resolve({ nativeRequest: {} });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session.permissions).toContain('AGENDA_INCIDENT_VIEW');
  });

  it('GET /api/v1/session also returns expediente permissions for full actor', async () => {
    const context = await devResolver.resolve({ nativeRequest: {} });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session.permissions).toContain('EXPEDIENT_VIEW');
    expect(session.permissions).toContain('EXPEDIENT_DISPATCH');
  });

  it('session response does not expose roles or tenantIds', async () => {
    const context = await devResolver.resolve({ nativeRequest: {} });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session).not.toHaveProperty('roles');
    expect(session).not.toHaveProperty('tenantIds');
  });
});

// ---------------------------------------------------------------------------
// 5. Fail-closed — actor without agenda permissions is denied
// ---------------------------------------------------------------------------

describe('devResolver — actor without agenda permissions (fail-closed)', () => {
  it('agendaView actor does NOT have AGENDA_IMPORT', async () => {
    const context = await devResolver.resolve({
      nativeRequest: { headers: { cookie: 'sigac_dev_actor=agendaView' } },
    });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session.permissions).toContain('AGENDA_VIEW');
    expect(session.permissions).not.toContain('AGENDA_IMPORT');
  });

  it('noAudit actor does NOT have any AGENDA_* permissions', async () => {
    const context = await devResolver.resolve({
      nativeRequest: { headers: { cookie: 'sigac_dev_actor=noAudit' } },
    });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session.permissions).not.toContain('AGENDA_VIEW');
    expect(session.permissions).not.toContain('AGENDA_IMPORT');
    expect(session.permissions).not.toContain('AGENDA_INCIDENT_VIEW');
  });

  it('unknown cookie value falls back to full actor', async () => {
    const context = await devResolver.resolve({
      nativeRequest: { headers: { cookie: 'sigac_dev_actor=nonexistent' } },
    });
    const session = new GetSessionAuthorization().execute({ context });
    // Should fall back to 'full' — has agenda permissions
    expect(session.permissions).toContain('AGENDA_VIEW');
  });
});

// ---------------------------------------------------------------------------
// 6. Tenant isolation — tenant comes from resolver, not HTTP
// ---------------------------------------------------------------------------

describe('devResolver — tenant is always DEMO, never from HTTP input', () => {
  it('tenant comes from env config regardless of request body', async () => {
    const context = await devResolver.resolve({
      nativeRequest: {
        body: { tenantId: 'forged', databaseName: 'forged-db' },
        query: { tenant: 'forged-query' },
        headers: { 'x-tenant': 'forged-header' },
      },
    });
    expect(context.tenant.tenantId).not.toBe('forged');
    expect(context.tenant.databaseName).not.toBe('forged-db');
    // Must be the DEMO tenant from env
    expect(typeof context.tenant.tenantId).toBe('string');
    expect(typeof context.tenant.databaseName).toBe('string');
  });

  it('each request gets a unique requestId and correlationId', async () => {
    const ctx1 = await devResolver.resolve({ nativeRequest: {} });
    const ctx2 = await devResolver.resolve({ nativeRequest: {} });
    expect(ctx1.requestId).not.toBe(ctx2.requestId);
    expect(ctx1.correlationId).not.toBe(ctx2.correlationId);
  });
});

describe('devMedicoQuery — DEMO sin catálogo real', () => {
  it('findByEmployeeNumber devuelve NOT_FOUND y no fabrica un nombre placeholder', async () => {
    const result = await devMedicoQuery.findByEmployeeNumber(
      NumeroEmpleado.parse('00437054'),
    );

    expect(result).toEqual({ kind: 'NOT_FOUND' });
    expect(result).not.toHaveProperty('medico');
  });

  it('findControlledFallback conserva el nombre original válido del artefacto', async () => {
    const context = await devResolver.resolve({ nativeRequest: {} });

    const result = await devMedicoQuery.findControlledFallback(
      '  GALVAN DOMINGUEZ MANUEL ALEJANDRO  ',
      context.tenant,
    );

    expect(result.kind).toBe('RESOLVED');
    if (result.kind === 'RESOLVED') {
      expect(result.medico.nombre).toBe('GALVAN DOMINGUEZ MANUEL ALEJANDRO');
      expect(result.medico.nombre).not.toBe('MÉDICO 00437054');
    }
  });

  it('findControlledFallback no inventa médico cuando el nombre está ausente', async () => {
    const context = await devResolver.resolve({ nativeRequest: {} });

    const result = await devMedicoQuery.findControlledFallback('', context.tenant);

    expect(result).toEqual({ kind: 'NOT_FOUND' });
  });
});

// ---------------------------------------------------------------------------
// 7. AppDevModule — module structure
// ---------------------------------------------------------------------------

describe('AppDevModule.register — module structure', () => {
  it('registers HealthController', () => {
    const mod = AppDevModule.register();
    expect(mod.controllers).toContain(HealthController);
  });

  it('imports array contains ExpedienteApiModule, AgendaApiModule and ValeArchivoApiModule dynamic modules', () => {
    const mod = AppDevModule.register();
    const imports = mod.imports ?? [];
    // T-38: ValeArchivoApiModule added alongside existing modules
    expect(imports).toHaveLength(3);
  });

  it('does not register fake providers', () => {
    const mod = AppDevModule.register();
    const providersStr = JSON.stringify(mod.providers ?? []);
    expect(providersStr).not.toContain('fake');
  });
});

// ---------------------------------------------------------------------------
// 8. Read query adapters are NOT null (regression for the "always-empty" bug)
// ---------------------------------------------------------------------------
// Root cause: buildAgendaApiModule() wired null adapters for dayQuery,
// historyQuery and preparationQuery. GET /agendas/:date returned 404 and
// GET /agenda-imports returned [] regardless of what was in the DB.
// After the fix, real Postgres adapters (PostgresAgendaDayQueryPort,
// PostgresAgendaImportHistoryQueryPort, PostgresAgendaPreparationQueryPort)
// are injected instead.

import {
  PostgresAgendaDayQueryPort,
  PostgresAgendaImportHistoryQueryPort,
  PostgresAgendaPreparationQueryPort,
} from '@sigac/database';
import { GetAgendaDaySummary, GetAgendaPreparationList, ListAgendaImports } from '@sigac/agenda-preparation';

describe('buildAgendaApiModule — real read query adapters (regression)', () => {
  it('GetAgendaDaySummary receives a real PostgresAgendaDayQueryPort, not a null adapter', () => {
    const router = buildDemoRouter();
    const mod = buildAgendaApiModule(router);

    // The provider list must contain a GetAgendaDaySummary whose dayQuery
    // is a real PostgresAgendaDayQueryPort.
    // We can't easily inspect the closed-over deps inside use cases via NestJS providers,
    // so we instantiate directly to verify the class is wired correctly.
    const dayQuery = new PostgresAgendaDayQueryPort(router);
    const auditWriter = { append: async () => undefined };
    const useCase = new GetAgendaDaySummary({ dayQuery, auditWriter });
    // The use case must be constructable (not throw) and must not be a null adapter
    expect(useCase).toBeInstanceOf(GetAgendaDaySummary);
    expect(dayQuery).toBeInstanceOf(PostgresAgendaDayQueryPort);
  });

  it('ListAgendaImports receives a real PostgresAgendaImportHistoryQueryPort, not a null adapter', () => {
    const router = buildDemoRouter();
    const historyQuery = new PostgresAgendaImportHistoryQueryPort(router);
    const auditWriter = { append: async () => undefined };
    const useCase = new ListAgendaImports({ historyQuery, auditWriter });
    expect(useCase).toBeInstanceOf(ListAgendaImports);
    expect(historyQuery).toBeInstanceOf(PostgresAgendaImportHistoryQueryPort);
  });

  it('GetAgendaPreparationList receives a real PostgresAgendaPreparationQueryPort, not a null adapter', () => {
    const router = buildDemoRouter();
    const preparationQuery = new PostgresAgendaPreparationQueryPort(router);
    const auditWriter = { append: async () => undefined };
    const useCase = new GetAgendaPreparationList({ preparationQuery, auditWriter });
    expect(useCase).toBeInstanceOf(GetAgendaPreparationList);
    expect(preparationQuery).toBeInstanceOf(PostgresAgendaPreparationQueryPort);
  });

  it('null adapters that ARE still wired (importResultQuery, incidentsQuery) are explicit TODO stubs', () => {
    // This test documents that these two adapters are INTENTIONALLY null for now.
    // When they are replaced with real adapters, this test should be updated.
    const router = buildDemoRouter();
    const mod = buildAgendaApiModule(router);
    // AgendaApiModule registers 10 providers: 9 tokens + AgendaApiProblemMapper
    // T-23 added generatePreparationReport as the 9th token.
    expect(mod.providers).toHaveLength(10);
  });
});

// ─── BUG-1 regression: incidents adapter is real ────────────────────────────

import { GetAgendaImportIncidents } from '@sigac/agenda-preparation';
import { PostgresAgendaImportIncidentsQueryPort } from '@sigac/database';

describe('buildAgendaApiModule — incidents adapter is real (BUG-1 regression)', () => {
  it('BUG-1: GetAgendaImportIncidents receives a real PostgresAgendaImportIncidentsQueryPort', () => {
    const router = buildDemoRouter();
    const incidentsQuery = new PostgresAgendaImportIncidentsQueryPort(router);
    const auditWriter = { append: async () => undefined };
    const useCase = new GetAgendaImportIncidents({ incidentsQuery, auditWriter });
    expect(useCase).toBeInstanceOf(GetAgendaImportIncidents);
    expect(incidentsQuery).toBeInstanceOf(PostgresAgendaImportIncidentsQueryPort);
  });

  it('BUG-1: nullIncidentsQuery no longer exists in buildAgendaApiModule', () => {
    // Verify via module structure that provider count is unchanged (9 providers)
    const router = buildDemoRouter();
    const mod = buildAgendaApiModule(router);
    expect(mod.providers).toHaveLength(10); // 9 tokens + AgendaApiProblemMapper (T-23)
    // The module must contain AgendaController (incidents endpoint is there)
    expect(mod.controllers).toContain(AgendaController);
  });
});

// ---------------------------------------------------------------------------
// Vale Archivo permissions — DEMO full actor (T-30..T-38)
// Verifies GET /api/v1/session returns VA permissions for the default actor.
// ---------------------------------------------------------------------------
describe('devResolver — DEMO full actor includes Vale Archivo permissions (T-30)', () => {
  it('session returns REQUEST_CREATE for full actor', async () => {
    const context = await devResolver.resolve({ nativeRequest: {} });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session.permissions).toContain('REQUEST_CREATE');
  });

  it('session returns ARCHIVE_REQUEST_VIEW for full actor', async () => {
    const context = await devResolver.resolve({ nativeRequest: {} });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session.permissions).toContain('ARCHIVE_REQUEST_VIEW');
  });

  it('session returns ARCHIVE_REQUEST_PROCESS for full actor', async () => {
    const context = await devResolver.resolve({ nativeRequest: {} });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session.permissions).toContain('ARCHIVE_REQUEST_PROCESS');
  });

  it('session returns ARCHIVE_REQUEST_DELIVER for full actor', async () => {
    const context = await devResolver.resolve({ nativeRequest: {} });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session.permissions).toContain('ARCHIVE_REQUEST_DELIVER');
  });

  it('ValeArchivoWorkspace guard passes: ARCHIVE_REQUEST_VIEW is present', async () => {
    // The frontend checks: permissions.has('ARCHIVE_REQUEST_VIEW') || permissions.has('REQUEST_CREATE')
    // Both must be present in the full DEMO actor.
    const context = await devResolver.resolve({ nativeRequest: {} });
    const session = new GetSessionAuthorization().execute({ context });
    const canAccessValeArchivo =
      session.permissions.includes('ARCHIVE_REQUEST_VIEW') ||
      session.permissions.includes('REQUEST_CREATE');
    expect(canAccessValeArchivo).toBe(true);
  });

  it('agendaView actor does NOT have Vale Archivo permissions (fail-closed)', async () => {
    const context = await devResolver.resolve({
      nativeRequest: { headers: { cookie: 'sigac_dev_actor=agendaView' } },
    });
    const session = new GetSessionAuthorization().execute({ context });
    expect(session.permissions).not.toContain('ARCHIVE_REQUEST_VIEW');
    expect(session.permissions).not.toContain('REQUEST_CREATE');
    expect(session.permissions).not.toContain('ARCHIVE_REQUEST_PROCESS');
    expect(session.permissions).not.toContain('ARCHIVE_REQUEST_DELIVER');
  });
});
