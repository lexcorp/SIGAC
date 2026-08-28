/**
 * dev-composition-root.ts
 *
 * Development / DEMO composition root for apps/api.
 *
 * Wires ExpedienteApiModule + AgendaApiModule using real Postgres adapters
 * and a cookie-based actor resolver identical to the E2E harness pattern.
 * This is intentionally NOT a production resolver — production requires a
 * real OIDC/JWT implementation (see OIDC_ISSUER in .env.example).
 *
 * The DEMO actor (default, no cookie) includes all permissions needed to
 * exercise every implemented feature including AGENDA_VIEW, AGENDA_IMPORT,
 * AGENDA_INCIDENT_VIEW.
 *
 * Tenant is resolved from DEMO_DATABASE env var — never from HTTP input.
 *
 * DO NOT import this file from AppModule. AppModule remains production-only
 * and continues mounting only HealthController until OIDC is ready.
 */

import { randomUUID } from 'node:crypto';
import {
  AcceptCustody,
  DispatchExpediente,
  ExpedienteCapabilityService,
  GetExpediente,
  GetExpedienteAudit,
  GetExpedienteTimeline,
  GetSessionAuthorization,
  ListUbicaciones,
  SearchExpedientesByNumero,
  type ActiveLoanQueryPort,
  type ActiveRequestQueryPort,
  type ExitEnablingSourceQueryPort,
  type OpenIncidentsQueryPort,
} from '@sigac/archive-operations';
import {
  GeneratePreparationReport,
  GetAgendaDaySummary,
  GetAgendaImportIncidents,
  GetAgendaImportResult,
  GetAgendaPreparationList,
  ImportAgenda,
  ListAgendaImports,
  MedicoReferencia,
  NumeroEmpleado,
  PrintAgendaPreparationList,
  SimefAgendaParserAdapter,
} from '@sigac/agenda-preparation';
import {
  PDFKitPreparationReportGenerator,
  PDFKitValeArchivoGenerator,
} from '@sigac/pdf';
import {
  CerrarValeAdministrativo,
  ConsultarVale,
  GenerarPdfVale,
  IniciarBusqueda,
  ListarVales,
  RegistrarEntrega,
  RegistrarLocalizacion,
  RegistrarVale,
} from '@sigac/vale-archivo';
import {
  PostgresAgendaPreparationUnitOfWork,
  PostgresAgendaDayQueryPort,
  PostgresAgendaImportHistoryQueryPort,
  PostgresAgendaImportIncidentsQueryPort,
  PostgresAgendaPreparationQueryPort,
  PostgresArchiveOperationsUnitOfWork,
  PostgresAuditWriter,
  PostgresExpedienteAuditQueryPort,
  PostgresExpedienteRepository,
  PostgresExpedienteTimelineQueryPort,
  PostgresIdempotencyKeyRepository,
  PostgresImportArtifactMetadataRepository,
  PostgresUbicacionesQueryPort,
  TenantDatabaseRouter,
  PostgresValeArchivoRepository,
  PostgresValeArchivoQueryAdapter,
} from '@sigac/database';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import type { AuthenticatedRequestContextResolver } from './expediente/expediente-api.contracts.js';
import { AgendaApiModule } from './agenda/agenda-api.module.js';
import { ValeArchivoApiModule } from './vale-archivo/vale-archivo-api.module.js';
import { ExpedienteApiModule } from './expediente/expediente-api.module.js';

// ---------------------------------------------------------------------------
// DEMO tenant — from env, never from HTTP input
// ---------------------------------------------------------------------------

const DEMO_TENANT_ID = process.env['DEFAULT_TENANT_SLUG'] ?? 'demo';
const DEMO_DATABASE  = process.env['DEMO_DATABASE']         ?? 'sigac_demo';
const DEMO_TIMEZONE  = process.env['DEFAULT_TIMEZONE']      ?? 'America/Mexico_City';
const PG_HOST        = process.env['POSTGRES_HOST']         ?? 'localhost';
const PG_PORT        = parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10);
const PG_USER        = process.env['POSTGRES_USER']         ?? 'sigac';
const PG_PASSWORD    = process.env['POSTGRES_PASSWORD']     ?? 'sigac_dev_only';

const demoTenant: TenantContext = {
  tenantId:     DEMO_TENANT_ID,
  slug:         DEMO_TENANT_ID,
  hospitalId:   DEMO_TENANT_ID,
  databaseName: DEMO_DATABASE,
  timezone:     DEMO_TIMEZONE,
};

const demoConnectionString =
  `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${DEMO_DATABASE}`;

// ---------------------------------------------------------------------------
// DEMO actors — cookie-based selection (dev/DEMO only)
//
// Cookie name: sigac_dev_actor
// Values: 'noAudit' | 'agendaView' | (default) 'full'
//
// The `full` actor includes every permission needed for all implemented
// features: Archive Operations, Agenda Preparation, Preparation Reports,
// and Vale Archivo (T-30..T-38).
// ---------------------------------------------------------------------------

type ActorKey = 'full' | 'noAudit' | 'agendaView';

interface DemoActor {
  readonly actorId: string;
  readonly permissions: ReadonlySet<string>;
}

const DEMO_ACTORS: Record<ActorKey, DemoActor> = {
  full: {
    actorId: 'demo-full',
    permissions: new Set([
      // Archive Operations
      'EXPEDIENT_VIEW', 'EXPEDIENT_AUDIT_VIEW', 'LOCATION_VIEW',
      'EXPEDIENT_DISPATCH', 'CUSTODY_ACCEPT', 'LOAN_OPEN',
      // Agenda Preparation — required for AgendaPreparationWorkspace
      'AGENDA_VIEW', 'AGENDA_IMPORT', 'AGENDA_INCIDENT_VIEW',
      // Preparation Reports — T-20 REQ-PR-005
      'AGENDA_PRINT',
      // Vale Archivo — T-30 REQ-VA-001..REQ-VA-007, ADR-0033
      // Required for ValeArchivoWorkspace and all VA use cases.
      'REQUEST_CREATE',          // crear vale, ver detalle/PDF, cierre administrativo
      'ARCHIVE_REQUEST_VIEW',    // listar, consultar detalle, descargar PDF SM 1-14
      'ARCHIVE_REQUEST_PROCESS', // iniciar búsqueda, registrar localización
      'ARCHIVE_REQUEST_DELIVER', // registrar entrega, cerrar ciclo
    ]),
  },
  noAudit: {
    actorId: 'demo-no-audit',
    permissions: new Set([
      'EXPEDIENT_VIEW', 'LOCATION_VIEW', 'EXPEDIENT_DISPATCH', 'LOAN_OPEN',
    ]),
  },
  agendaView: {
    actorId: 'demo-agenda-view',
    permissions: new Set([
      'AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW',
    ]),
  },
};

function resolveActorKey(request: unknown): ActorKey {
  const cookie = String(
    (request as { headers?: { cookie?: string } }).headers?.cookie ?? '',
  );
  const value = /(?:^|;\s*)sigac_dev_actor=([^;]+)/.exec(cookie)?.[1];
  if (value === 'noAudit')    return 'noAudit';
  if (value === 'agendaView') return 'agendaView';
  return 'full';
}

export const devResolver: AuthenticatedRequestContextResolver = {
  async resolve(input): Promise<RequestContext> {
    const actor = DEMO_ACTORS[resolveActorKey(input.nativeRequest)];
    return {
      actor: {
        actorId:    actor.actorId,
        roles:      new Set<string>(),
        permissions: actor.permissions,
        tenantIds:  new Set([DEMO_TENANT_ID]),
      },
      tenant:        demoTenant,
      requestId:     randomUUID(),
      correlationId: randomUUID(),
      source:        'WEB',
    };
  },
};

// ---------------------------------------------------------------------------
// Postgres router — exported so AppDevModule can close it on shutdown
// ---------------------------------------------------------------------------

export function buildDemoRouter(): TenantDatabaseRouter {
  return new TenantDatabaseRouter([{
    tenantId:         DEMO_TENANT_ID,
    databaseName:     DEMO_DATABASE,
    connectionString: demoConnectionString,
  }]);
}

// ---------------------------------------------------------------------------
// Null adapters — for ports not yet backed by real Postgres queries in DEMO.
// These let permission checks run normally while returning empty/null data.
// Replace with real adapters as each query port is implemented.
// ---------------------------------------------------------------------------

const nullActiveRequestQuery: ActiveRequestQueryPort = {
  findActiveByExpedienteId: async () => null,
};
const nullActiveLoanQuery: ActiveLoanQueryPort = {
  findActiveByExpedienteId: async () => null,
};
const nullOpenIncidentsQuery: OpenIncidentsQueryPort = {
  findOpenByExpedienteId: async () => [],
};
const nullExitEnablingSourceQuery: ExitEnablingSourceQueryPort = {
  findAvailableByExpediente: async () => [],
};

// nullImportResultQuery replaced by real adapter when GetAgendaImportResult is implemented.
const nullImportResultQuery  = { findById: async () => null };

// NOTE: existing citas imported before this fix have 'DR DEMO SINTETICO'.
// New imports after this fix will carry the real name from orig_physician_name.
// DEMO physician resolver — no real physician directory is available in DEMO.
//
// findByEmployeeNumber returns NOT_FOUND so that processRows() falls through to
// findControlledFallback(), which uses orig_physician_name from the SIMEF artifact.
// This preserves the real physician name through the full import pipeline without
// requiring a physician catalogue.
//
// If a real MedicoDirectoryQueryPort is wired in the future, replace this object
// with a real adapter; findByEmployeeNumber should return RESOLVED with the
// directory's authoritative name, and findControlledFallback should remain as a
// fallback for employee numbers not found in the directory.
//
// T-P3 fix: previous version returned RESOLVED with 'MÉDICO {n.value}' which
// caused processRows() to skip findControlledFallback entirely, storing a
// synthetic placeholder instead of the real name from the Excel artifact.
export const devMedicoQuery = {
  findByEmployeeNumber: async (_n: NumeroEmpleado) => ({
    // No real physician directory in DEMO — return NOT_FOUND so the real name
    // from orig_physician_name is used via findControlledFallback below.
    kind: 'NOT_FOUND' as const,
  }),
  findControlledFallback: async (nombreOriginal: string, _tenant: import('@sigac/tenant').TenantContext) => {
    if (nombreOriginal && nombreOriginal.trim().length > 0) {
      return {
        kind: 'RESOLVED' as const,
        medico: MedicoReferencia.create({
          // Employee number is unknown via the name-lookup path.
          // The real number is already stored in interp_numero_empleado from
          // the parsed row; this resolution only supplies the authoritative name.
          numeroEmpleado: NumeroEmpleado.parse('00000000'),
          nombre: nombreOriginal.trim(),
        }),
      };
    }
    return { kind: 'NOT_FOUND' as const };
  },
};

const devExpedienteReferenceQuery = {
  resolve: async () => [] as const,
};

// ---------------------------------------------------------------------------
// Module factories
// ---------------------------------------------------------------------------

export function buildExpedienteApiModule(router: TenantDatabaseRouter) {
  const expedienteRepository = new PostgresExpedienteRepository(router);
  const auditWriter          = new PostgresAuditWriter(router);
  const unitOfWork           = new PostgresArchiveOperationsUnitOfWork(router);

  return ExpedienteApiModule.register({
    requestContextResolver:    devResolver,
    getExpediente:             new GetExpediente({
      expedienteRepository,
      activeRequestQuery:      nullActiveRequestQuery,
      activeLoanQuery:         nullActiveLoanQuery,
      openIncidentsQuery:      nullOpenIncidentsQuery,
      exitEnablingSourceQuery: nullExitEnablingSourceQuery,
      capabilityService:       new ExpedienteCapabilityService(),
      auditWriter,
    }),
    getExpedienteTimeline:     new GetExpedienteTimeline({
      expedienteRepository,
      timelineQuery:           new PostgresExpedienteTimelineQueryPort(router),
      auditWriter,
    }),
    getExpedienteAudit:        new GetExpedienteAudit({
      expedienteRepository,
      auditQuery:              new PostgresExpedienteAuditQueryPort(router),
    }),
    getSessionAuthorization:   new GetSessionAuthorization(),
    listUbicaciones:           new ListUbicaciones(new PostgresUbicacionesQueryPort(router)),
    searchExpedientesByNumero: new SearchExpedientesByNumero({ expedienteRepository, auditWriter }),
    dispatchExpediente:        new DispatchExpediente({ unitOfWork, auditWriter }),
    acceptCustody:             new AcceptCustody({ unitOfWork, auditWriter }),
  });
}

export function buildAgendaApiModule(router: TenantDatabaseRouter) {
  const auditWriter    = new PostgresAuditWriter(router);
  const agendaUoW      = new PostgresAgendaPreparationUnitOfWork(router);
  const metadataRepo   = new PostgresImportArtifactMetadataRepository(router);
  const idempotencyRepo = new PostgresIdempotencyKeyRepository(router);

  // ── Real read query adapters (fix: null adapters replaced) ──────────────
  const dayQueryPort         = new PostgresAgendaDayQueryPort(router);
  const historyQueryPort     = new PostgresAgendaImportHistoryQueryPort(router);
  const preparationQueryPort = new PostgresAgendaPreparationQueryPort(router);

  return AgendaApiModule.register({
    requestContextResolver:    devResolver,
    importAgenda:              new ImportAgenda({
      interpreter:             new SimefAgendaParserAdapter(),
      medicoQuery:             devMedicoQuery,
      expedienteQuery:         devExpedienteReferenceQuery,
      metadataRepository:      metadataRepo,
      idempotencyKeyRepository: idempotencyRepo,
      unitOfWork:              agendaUoW,
    }),
    getAgendaImportResult:     new GetAgendaImportResult({
      importResultQuery:       nullImportResultQuery,   // TODO: wire real adapter
      auditWriter,
    }),
    listAgendaImports:         new ListAgendaImports({
      historyQuery:            historyQueryPort,        // ← FIXED: was nullHistoryQuery
      auditWriter,
    }),
    getAgendaDaySummary:       new GetAgendaDaySummary({
      dayQuery:                dayQueryPort,            // ← FIXED: was nullDayQuery
      auditWriter,
    }),
    getAgendaPreparationList:  new GetAgendaPreparationList({
      preparationQuery:        preparationQueryPort,    // ← FIXED: was nullPreparationQuery
      auditWriter,
    }),
    printAgendaPreparationList: new PrintAgendaPreparationList({
      preparationQuery:        preparationQueryPort,    // ← FIXED: was nullPreparationQuery
      auditWriter,
    }),
    getAgendaImportIncidents:  new GetAgendaImportIncidents({
      incidentsQuery:          new PostgresAgendaImportIncidentsQueryPort(router), // ← FIXED
      auditWriter,
    }),
    // T-23 preparation-reports: PDF generation (ADR-0030 + ADR-0031)
    generatePreparationReport: new GeneratePreparationReport({
      preparationListQuery: preparationQueryPort,
      reportGenerator:      new PDFKitPreparationReportGenerator(),
      auditWriter,
    }),
  });
}

export function buildValeArchivoApiModule(router: TenantDatabaseRouter) {
  const auditWriter  = new PostgresAuditWriter(router);
  const repository   = new PostgresValeArchivoRepository(router);
  const queryAdapter = new PostgresValeArchivoQueryAdapter(router);

  return ValeArchivoApiModule.register({
    requestContextResolver: devResolver,
    registrarVale:            new RegistrarVale({ repository, auditWriter }),
    consultarVale:            new ConsultarVale({ queryPort: queryAdapter, auditWriter }),
    listarVales:              new ListarVales({ queryPort: queryAdapter, auditWriter }),
    iniciarBusqueda:          new IniciarBusqueda({ repository, auditWriter }),
    registrarLocalizacion:    new RegistrarLocalizacion({ repository, auditWriter }),
    registrarEntrega:         new RegistrarEntrega({ repository, auditWriter }),
    cerrarValeAdministrativo: new CerrarValeAdministrativo({ repository, auditWriter }),
    generarPdfVale:           new GenerarPdfVale({
      queryPort:    queryAdapter,
      pdfGenerator: new PDFKitValeArchivoGenerator(),
      auditWriter,
    }),
  });
}
