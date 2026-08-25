/**
 * E2E API harness — NestJS server for Playwright tests.
 *
 * ⚠️  THIS FILE IS TEST INFRASTRUCTURE ONLY.
 *     It does NOT affect production code, dev-composition-root.ts, or app.module.ts.
 *
 * T-27 changes vs T-18 baseline:
 *   - Added GeneratePreparationReport use case + PDFKitPreparationReportGenerator.
 *   - Replaced nullDayQuery and nullPreparationQuery with real PostgreSQL adapters
 *     (PostgresAgendaDayQueryPort, PostgresAgendaPreparationQueryPort).
 *     Reason: T-27 E2E tests exercise the full PDF generation flow which requires
 *     listForPrint() and findByDate() to return real seeded data from PostgreSQL.
 *     T-18 tests only exercised the write (import) path, so null adapters were
 *     sufficient there; they remain for nullImportResultQuery / nullHistoryQuery
 *     because those read paths are still not needed in E2E.
 *   - Extended seed() to insert synthetic citas for agenda date 2026-09-01
 *     (Tenant A only).  All data is desidentified; no SIMEF real data used.
 *
 * Actor selection via `sigac_e2e_actor` cookie:
 *   (none)           → full   (all permissions incl. AGENDA_PRINT)
 *   agendaImport     → agendaImport (AGENDA_VIEW + AGENDA_IMPORT + AGENDA_PRINT)
 *   agendaView       → agendaView  (AGENDA_VIEW only — no AGENDA_PRINT)
 *   agendaTenantB    → agendaTenantB (Tenant B)
 *   tenantB          → tenantB (Tenant B, archive perms)
 *   noAudit          → noAudit (archive perms, no audit)
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  AcceptCustody, DispatchExpediente, ExpedienteCapabilityService, GetExpediente,
  GetExpedienteAudit, GetExpedienteTimeline, GetSessionAuthorization, ListUbicaciones,
  SearchExpedientesByNumero,
  type ActiveLoanQueryPort, type ActiveRequestQueryPort, type ExitEnablingSourceQueryPort,
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
  PrintAgendaPreparationList,
  SimefAgendaParserAdapter,
  MedicoReferencia,
  NumeroEmpleado,
  type AgendaImportHistoryPage,
  type AgendaImportResult,
  type AgendaImportIncidentSummary,
} from '@sigac/agenda-preparation';
import {
  PostgresAgendaDayQueryPort,
  PostgresAgendaPreparationQueryPort,
  PostgresAgendaPreparationUnitOfWork,
  PostgresIdempotencyKeyRepository,
  PostgresImportArtifactMetadataRepository,
  PostgresArchiveOperationsUnitOfWork, PostgresAuditWriter, PostgresExpedienteAuditQueryPort,
  PostgresExpedienteRepository, PostgresExpedienteTimelineQueryPort, PostgresUbicacionesQueryPort,
  TenantDatabaseRouter,
} from '@sigac/database';
import { PDFKitPreparationReportGenerator } from '../../../packages/platform/pdf/src/index.js';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { Client } from 'pg';
import { ExpedienteApiModule, type AuthenticatedRequestContextResolver } from '../../../apps/api/src/expediente/index.js';
import { AgendaApiModule } from '../../../apps/api/src/agenda/agenda-api.module.js';
import { E2E, E2E_PR_DATE, E2E_PR_IMPORT_ID } from './fixtures.js';

const adminUrl = process.env.SIGAC_POSTGRES_ADMIN_URL ?? 'postgresql://sigac:sigac_dev_only@localhost:5432/postgres';
const databaseSuffix = randomUUID().replaceAll('-', '');
const databaseNames = [`sigac_e2e_workspace_a_${databaseSuffix}`, `sigac_e2e_workspace_b_${databaseSuffix}`] as const;
const dbUrl = (name: string) => { const url = new URL(adminUrl); url.pathname = `/${name}`; return url.toString(); };
const tenant = (key: 'a' | 'b'): TenantContext => ({ tenantId: `e2e-${key}`, slug: `e2e-${key}`, hospitalId: `hospital-${key}`, databaseName: key === 'a' ? databaseNames[0] : databaseNames[1], timezone: 'America/Mexico_City' });
const actors = {
  // 'full' is the default DEMO actor (no sigac_e2e_actor cookie).
  full: { tenant: tenant('a'), actor: { actorId: 'e2e-full', roles: new Set(['ARCHIVISTA', 'RECEPTOR_SERVICIO']), permissions: new Set(['EXPEDIENT_VIEW', 'EXPEDIENT_AUDIT_VIEW', 'LOCATION_VIEW', 'EXPEDIENT_DISPATCH', 'CUSTODY_ACCEPT', 'LOAN_OPEN', 'AGENDA_VIEW', 'AGENDA_IMPORT', 'AGENDA_INCIDENT_VIEW', 'AGENDA_PRINT']), tenantIds: new Set(['e2e-a']) } },
  noAudit: { tenant: tenant('a'), actor: { actorId: 'e2e-no-audit', roles: new Set(['ARCHIVISTA']), permissions: new Set(['EXPEDIENT_VIEW', 'LOCATION_VIEW', 'EXPEDIENT_DISPATCH', 'LOAN_OPEN']), tenantIds: new Set(['e2e-a']) } },
  tenantB: { tenant: tenant('b'), actor: { actorId: 'e2e-b', roles: new Set(['ARCHIVISTA']), permissions: new Set(['EXPEDIENT_VIEW']), tenantIds: new Set(['e2e-b']) } },
  // Agenda actors
  agendaImport: { tenant: tenant('a'), actor: { actorId: 'e2e-agenda-import', roles: new Set(['ARCHIVISTA']), permissions: new Set(['AGENDA_IMPORT', 'AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW', 'AGENDA_PRINT']), tenantIds: new Set(['e2e-a']) } },
  agendaView:   { tenant: tenant('a'), actor: { actorId: 'e2e-agenda-view',   roles: new Set(['ARCHIVISTA']), permissions: new Set(['AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW']), tenantIds: new Set(['e2e-a']) } },
  agendaTenantB:{ tenant: tenant('b'), actor: { actorId: 'e2e-agenda-b',      roles: new Set(['ARCHIVISTA']), permissions: new Set(['AGENDA_IMPORT', 'AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW', 'AGENDA_PRINT']), tenantIds: new Set(['e2e-b']) } },
} as const;

function actorKey(request: unknown): keyof typeof actors {
  const cookie = String((request as { headers?: { cookie?: string } }).headers?.cookie ?? '');
  const value = /(?:^|;\s*)sigac_e2e_actor=([^;]+)/.exec(cookie)?.[1];
  if (value === 'noAudit') return 'noAudit';
  if (value === 'tenantB') return 'tenantB';
  if (value === 'agendaImport') return 'agendaImport';
  if (value === 'agendaView') return 'agendaView';
  if (value === 'agendaTenantB') return 'agendaTenantB';
  return 'full';
}

const resolver: AuthenticatedRequestContextResolver = {
  async resolve(input): Promise<RequestContext> {
    const selected = actors[actorKey(input.nativeRequest)];
    return { ...selected, requestId: randomUUID(), correlationId: randomUUID(), source: 'WEB' };
  },
};

async function recreateDatabases(): Promise<void> {
  const admin = new Client({ connectionString: adminUrl }); await admin.connect();
  for (const name of databaseNames) {
    await admin.query(`CREATE DATABASE "${name}"`);
    const client = new Client({ connectionString: dbUrl(name) }); await client.connect();
    const migrationDir = new URL('../../../migrations/tenant/', import.meta.url);
    for (const file of (await readdir(migrationDir)).filter((item) => item.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL(file, migrationDir), 'utf8');
      for (const statement of sql.split('--> statement-breakpoint')) if (statement.trim()) await client.query(statement);
    }
    await seed(client, name === databaseNames[0] ? 'a' : 'b'); await client.end();
  }
  await admin.end();
}

// T-27 synthetic agenda date and import ID — defined in fixtures.ts
// (imported here so seed() can use them without re-declaring)

async function seed(client: Client, key: 'a' | 'b'): Promise<void> {
  // ── Archive Operations fixtures (unchanged from T-18) ─────────────────────
  await client.query(
    `INSERT INTO ubicaciones (id,codigo,descripcion) VALUES ($1,'ARCHIVO','Archivo central'),($2,'CONS-1','Consultorio uno')`,
    [E2E.locationArchive, E2E.locationConsult],
  );
  const rows = key === 'a' ? [
    [E2E.single,      'PERR810604/10', 'PERR81060410', 'Paciente operativo uno', 'APARTADO'],
    [E2E.duplicateOne,'DUPL810604/20', 'DUPL81060420', 'Duplicado uno',          'DISPONIBLE'],
    [E2E.duplicateTwo,'DUPL810604/20', 'DUPL81060420', 'Duplicado dos',          'DISPONIBLE'],
    [E2E.loanValid,   'LOAN810604/30', 'LOAN81060430', 'Fuente válida',          'DISPONIBLE'],
    [E2E.loanInvalid, 'NOVL810604/40', 'NOVL81060440', 'Fuente inválida',        'DISPONIBLE'],
    [E2E.conflict,    'CONF810604/50', 'CONF81060450', 'Conflicto',              'APARTADO'],
  ] : [[E2E.tenantBOnly,'ONLY810604/60','ONLY81060460','Tenant B','DISPONIBLE']];
  for (const row of rows) {
    await client.query(
      `INSERT INTO expedientes (id,expediente_numero,expediente_numero_normalizado,paciente_id_institucional,paciente_curp,paciente_nombre_operativo,paciente_numero_issste,estado_operativo,ubicacion_actual_id,row_version) VALUES ($1,$2,$3,'INST-E2E','CURP-E2E',$4,'ISSSTE-E2E',$5,$6,0)`,
      [...row, E2E.locationArchive],
    );
  }
  if (key === 'a') {
    for (let index = 0; index < 26; index++) {
      await client.query(
        `INSERT INTO movimientos_expediente (id,expediente_id,movement_type,origin_location_id,destination_location_id,origin_custodian_ref,destination_custodian_ref,business_reference_type,business_reference_id,occurred_at,recorded_at,actor_ref,source,correlation_id) VALUES ($1,$2,'DISPATCHED',$3,$4,NULL,'receiver','E2E',NULL,$5,$5,'seed','INTERNAL','seed-correlation')`,
        [randomUUID(), E2E.single, E2E.locationArchive, E2E.locationConsult, new Date(Date.UTC(2026, 0, index + 1))],
      );
    }
    for (let index = 0; index < 26; index++) {
      await client.query(
        `INSERT INTO audit_log (id,actor_ref,action,resource_type,resource_id,result,request_id,correlation_id,source,occurred_at,change_summary,security_context) VALUES ($1,'seed',$2,'EXPEDIENTE',$3,'success','seed-request','seed-correlation','INTERNAL',$4,'{"private":"hidden"}','{"private":"hidden"}')`,
        [randomUUID(), `E2E_AUDIT_${index}`, E2E.single, new Date(Date.UTC(2026, 1, index + 1))],
      );
    }

    // ── T-27: Synthetic agenda citas for PDF generation E2E tests ─────────
    // Date: 2026-09-01 | Tenant A only | All data desidentified.
    // Three ACTIVAS: two matutinas (07:x), one vespertina (14:x).
    // No CURP, no phone, no DOB, no age, no sex stored in citas table.
    await client.query(
      `INSERT INTO agenda_imports
         (id, agenda_date, imported_at, outcome,
          received_records, processed, added, updated, unchanged,
          restored, pending_review, rejected, duplicate_folio,
          withdrawn_from_agenda, incidents, errors)
       VALUES ($1, $2, now(), 'IMPORTED', 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0)`,
      [E2E_PR_IMPORT_ID, E2E_PR_DATE],
    );
    await client.query(
      `INSERT INTO agendas (agenda_date) VALUES ($1)`,
      [E2E_PR_DATE],
    );
    const citasE2E = [
      ['FOLIO-E2E-PR-001', '07:00', 'PENSIONISTA', 'FIRST_TIME',  'PACIENTE SINTETICO E2E PR UNO'],
      ['FOLIO-E2E-PR-002', '07:20', 'ACTIVO',      'SUBSEQUENT',  'PACIENTE SINTETICO E2E PR DOS'],
      ['FOLIO-E2E-PR-003', '14:00', 'PENSIONISTA', 'FIRST_TIME',  'PACIENTE SINTETICO E2E PR TRES'],
    ] as const;
    for (const [folio, hora, tipo, consulta, nombre] of citasE2E) {
      await client.query(
        `INSERT INTO citas
           (agenda_date, folio, hora, expediente_reference, nombre_paciente,
            tipo_derechohabiente, tipo_consulta,
            medico_numero_empleado, medico_nombre,
            servicio_codigo, servicio_nombre, lifecycle)
         VALUES ($1,$2,$3,null,$4,$5,$6,
                 '55501','DR E2E SINTETICO',
                 'CIR','CIRUGIA E2E','ACTIVA')`,
        [E2E_PR_DATE, folio, hora, nombre, tipo, consulta],
      );
    }
  }
}

async function main(): Promise<void> {
  await recreateDatabases();
  const router = new TenantDatabaseRouter([
    { tenantId: 'e2e-a', databaseName: databaseNames[0], connectionString: dbUrl(databaseNames[0]) },
    { tenantId: 'e2e-b', databaseName: databaseNames[1], connectionString: dbUrl(databaseNames[1]) },
  ]);

  // ── Archive Operations ─────────────────────────────────────────────────────
  const repository = new PostgresExpedienteRepository(router);
  const auditWriter = new PostgresAuditWriter(router);
  const emptyRequest: ActiveRequestQueryPort = { async findActiveByExpedienteId() { return null; } };
  const emptyLoan: ActiveLoanQueryPort = { async findActiveByExpedienteId() { return null; } };
  const emptyIncidents: OpenIncidentsQueryPort = { async findOpenByExpedienteId() { return []; } };
  const sources: ExitEnablingSourceQueryPort = {
    async findAvailableByExpediente(id) {
      return id.value === E2E.loanValid ? [{ tipo: 'CONSULTA_PROGRAMADA', validada: true }]
           : id.value === E2E.loanInvalid ? [{ tipo: 'VALE_ARCHIVO_SM_1_14', validada: false }]
           : [];
    },
  };
  const unitOfWork = new PostgresArchiveOperationsUnitOfWork(router);
  const apiModule = ExpedienteApiModule.register({
    requestContextResolver: resolver,
    getExpediente: new GetExpediente({ expedienteRepository: repository, activeRequestQuery: emptyRequest, activeLoanQuery: emptyLoan, openIncidentsQuery: emptyIncidents, exitEnablingSourceQuery: sources, capabilityService: new ExpedienteCapabilityService(), auditWriter }),
    getExpedienteTimeline: new GetExpedienteTimeline({ expedienteRepository: repository, timelineQuery: new PostgresExpedienteTimelineQueryPort(router), auditWriter }),
    getExpedienteAudit: new GetExpedienteAudit({ expedienteRepository: repository, auditQuery: new PostgresExpedienteAuditQueryPort(router) }),
    getSessionAuthorization: new GetSessionAuthorization(),
    listUbicaciones: new ListUbicaciones(new PostgresUbicacionesQueryPort(router)),
    searchExpedientesByNumero: new SearchExpedientesByNumero({ expedienteRepository: repository, auditWriter }),
    dispatchExpediente: new DispatchExpediente({ unitOfWork, auditWriter }),
    acceptCustody: new AcceptCustody({ unitOfWork, auditWriter }),
  });

  // ── Agenda Preparation ─────────────────────────────────────────────────────
  const agendaParser = new SimefAgendaParserAdapter();
  const agendaUoW = new PostgresAgendaPreparationUnitOfWork(router);
  const agendaMetadataRepo = new PostgresImportArtifactMetadataRepository(router);
  const agendaIdempotencyRepo = new PostgresIdempotencyKeyRepository(router);

  // E2E-only medico query: resolves any employee number synthetically
  const e2eMedicoQuery = {
    findByEmployeeNumber: async (numeroEmpleado: NumeroEmpleado) => ({
      kind: 'RESOLVED' as const,
      medico: MedicoReferencia.create({ numeroEmpleado, nombre: 'DR E2E SINTETICO' }),
    }),
    findControlledFallback: async (_nombre: string) => ({ kind: 'NOT_FOUND' as const }),
  };
  const e2eExpedienteQuery = { resolve: async () => [] as const };

  // Null adapters retained for read paths not exercised in E2E
  // (import result detail and history — tested via unit/integration suites)
  const nullImportResultQuery = { findById: async (): Promise<AgendaImportResult | null> => null };
  const nullHistoryQuery = { findAll: async (): Promise<AgendaImportHistoryPage> => ({ items: [], nextCursor: null }) };
  const nullIncidentsQuery = { findByImportacionId: async (): Promise<readonly AgendaImportIncidentSummary[]> => [] };

  // T-27: real PostgreSQL adapters for day summary and preparation list.
  // Required so that generatePreparationReport can retrieve seeded citas.
  const realDayQuery = new PostgresAgendaDayQueryPort(router);
  const realPreparationQuery = new PostgresAgendaPreparationQueryPort(router);

  const agendaApiModule = AgendaApiModule.register({
    requestContextResolver: resolver,
    importAgenda: new ImportAgenda({
      interpreter: agendaParser,
      medicoQuery: e2eMedicoQuery,
      expedienteQuery: e2eExpedienteQuery,
      metadataRepository: agendaMetadataRepo,
      idempotencyKeyRepository: agendaIdempotencyRepo,
      unitOfWork: agendaUoW,
    }),
    getAgendaImportResult: new GetAgendaImportResult({
      importResultQuery: nullImportResultQuery,
      auditWriter,
    }),
    listAgendaImports: new ListAgendaImports({
      historyQuery: nullHistoryQuery,
      auditWriter,
    }),
    // T-27: real adapter — getAgendaDaySummary is called by the controller
    // to resolve latestImportacionId before invoking generatePreparationReport.
    getAgendaDaySummary: new GetAgendaDaySummary({
      dayQuery: realDayQuery,
      auditWriter,
    }),
    // T-27: real adapter — preparation list used by generatePreparationReport
    // and by getAgendaPreparationList UI endpoint.
    getAgendaPreparationList: new GetAgendaPreparationList({
      preparationQuery: realPreparationQuery,
      auditWriter,
    }),
    printAgendaPreparationList: new PrintAgendaPreparationList({
      preparationQuery: realPreparationQuery,
      auditWriter,
    }),
    getAgendaImportIncidents: new GetAgendaImportIncidents({
      incidentsQuery: nullIncidentsQuery,
      auditWriter,
    }),
    // T-27: PDF generation use case wired with real ports.
    generatePreparationReport: new GeneratePreparationReport({
      preparationListQuery: realPreparationQuery,
      reportGenerator: new PDFKitPreparationReportGenerator(),
      auditWriter,
    }),
  });

  @Module({ imports: [apiModule, agendaApiModule] }) class E2eModule { }
  const app = await NestFactory.create(E2eModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(3000);

  async function shutdown() {
    await app.close(); await router.close();
    const admin = new Client({ connectionString: adminUrl }); await admin.connect();
    for (const name of databaseNames) {
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    }
    await admin.end(); process.exit(0);
  }
  process.on('SIGTERM', () => { void shutdown(); });
  process.on('SIGINT',  () => { void shutdown(); });
}

void main();
