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
  type AgendaDayReadModel,
  type PreparationPage,
  type PreparationItem,
  type AgendaImportIncidentSummary,
} from '@sigac/agenda-preparation';
import {
  PostgresAgendaPreparationUnitOfWork,
  PostgresIdempotencyKeyRepository,
  PostgresImportArtifactMetadataRepository,
  PostgresArchiveOperationsUnitOfWork, PostgresAuditWriter, PostgresExpedienteAuditQueryPort,
  PostgresExpedienteRepository, PostgresExpedienteTimelineQueryPort, PostgresUbicacionesQueryPort,
  TenantDatabaseRouter,
} from '@sigac/database';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { Client } from 'pg';
import { ExpedienteApiModule, type AuthenticatedRequestContextResolver } from '../../../apps/api/src/expediente/index.js';
import { AgendaApiModule } from '../../../apps/api/src/agenda/agenda-api.module.js';
import { E2E } from './fixtures.js';

const adminUrl = process.env.SIGAC_POSTGRES_ADMIN_URL ?? 'postgresql://sigac:sigac_dev_only@localhost:5432/postgres';
const databaseSuffix = randomUUID().replaceAll('-', '');
const databaseNames = [`sigac_e2e_workspace_a_${databaseSuffix}`, `sigac_e2e_workspace_b_${databaseSuffix}`] as const;
const dbUrl = (name: string) => { const url = new URL(adminUrl); url.pathname = `/${name}`; return url.toString(); };
const tenant = (key: 'a' | 'b'): TenantContext => ({ tenantId: `e2e-${key}`, slug: `e2e-${key}`, hospitalId: `hospital-${key}`, databaseName: key === 'a' ? databaseNames[0] : databaseNames[1], timezone: 'America/Mexico_City' });
const actors = {
  // 'full' is the default DEMO actor (no sigac_e2e_actor cookie).
  // Includes all permissions required to exercise every implemented feature in the DEMO environment,
  // including Agenda Preparation (AGENDA_VIEW, AGENDA_IMPORT, AGENDA_INCIDENT_VIEW).
  full: { tenant: tenant('a'), actor: { actorId: 'e2e-full', roles: new Set(['ARCHIVISTA', 'RECEPTOR_SERVICIO']), permissions: new Set(['EXPEDIENT_VIEW', 'EXPEDIENT_AUDIT_VIEW', 'LOCATION_VIEW', 'EXPEDIENT_DISPATCH', 'CUSTODY_ACCEPT', 'LOAN_OPEN', 'AGENDA_VIEW', 'AGENDA_IMPORT', 'AGENDA_INCIDENT_VIEW']), tenantIds: new Set(['e2e-a']) } },
  noAudit: { tenant: tenant('a'), actor: { actorId: 'e2e-no-audit', roles: new Set(['ARCHIVISTA']), permissions: new Set(['EXPEDIENT_VIEW', 'LOCATION_VIEW', 'EXPEDIENT_DISPATCH', 'LOAN_OPEN']), tenantIds: new Set(['e2e-a']) } },
  tenantB: { tenant: tenant('b'), actor: { actorId: 'e2e-b', roles: new Set(['ARCHIVISTA']), permissions: new Set(['EXPEDIENT_VIEW']), tenantIds: new Set(['e2e-b']) } },
  // Agenda actors
  agendaImport: { tenant: tenant('a'), actor: { actorId: 'e2e-agenda-import', roles: new Set(['ARCHIVISTA']), permissions: new Set(['AGENDA_IMPORT', 'AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW']), tenantIds: new Set(['e2e-a']) } },
  agendaView: { tenant: tenant('a'), actor: { actorId: 'e2e-agenda-view', roles: new Set(['ARCHIVISTA']), permissions: new Set(['AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW']), tenantIds: new Set(['e2e-a']) } },
  agendaTenantB: { tenant: tenant('b'), actor: { actorId: 'e2e-agenda-b', roles: new Set(['ARCHIVISTA']), permissions: new Set(['AGENDA_IMPORT', 'AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW']), tenantIds: new Set(['e2e-b']) } },
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

async function seed(client: Client, key: 'a' | 'b'): Promise<void> {
  await client.query(`INSERT INTO ubicaciones (id,codigo,descripcion) VALUES ($1,'ARCHIVO','Archivo central'),($2,'CONS-1','Consultorio uno')`, [E2E.locationArchive, E2E.locationConsult]);
  const rows = key === 'a' ? [
    [E2E.single, 'PERR810604/10', 'PERR81060410', 'Paciente operativo uno', 'APARTADO'],
    [E2E.duplicateOne, 'DUPL810604/20', 'DUPL81060420', 'Duplicado uno', 'DISPONIBLE'],
    [E2E.duplicateTwo, 'DUPL810604/20', 'DUPL81060420', 'Duplicado dos', 'DISPONIBLE'],
    [E2E.loanValid, 'LOAN810604/30', 'LOAN81060430', 'Fuente válida', 'DISPONIBLE'],
    [E2E.loanInvalid, 'NOVL810604/40', 'NOVL81060440', 'Fuente inválida', 'DISPONIBLE'],
    [E2E.conflict, 'CONF810604/50', 'CONF81060450', 'Conflicto', 'APARTADO'],
  ] : [[E2E.tenantBOnly, 'ONLY810604/60', 'ONLY81060460', 'Tenant B', 'DISPONIBLE']];
  for (const row of rows) await client.query(`INSERT INTO expedientes (id,expediente_numero,expediente_numero_normalizado,paciente_id_institucional,paciente_curp,paciente_nombre_operativo,paciente_numero_issste,estado_operativo,ubicacion_actual_id,row_version) VALUES ($1,$2,$3,'INST-E2E','CURP-E2E',$4,'ISSSTE-E2E',$5,$6,0)`, [...row, E2E.locationArchive]);
  if (key === 'a') {
    for (let index = 0; index < 26; index++) await client.query(`INSERT INTO movimientos_expediente (id,expediente_id,movement_type,origin_location_id,destination_location_id,origin_custodian_ref,destination_custodian_ref,business_reference_type,business_reference_id,occurred_at,recorded_at,actor_ref,source,correlation_id) VALUES ($1,$2,'DISPATCHED',$3,$4,NULL,'receiver','E2E',NULL,$5,$5,'seed','INTERNAL','seed-correlation')`, [randomUUID(), E2E.single, E2E.locationArchive, E2E.locationConsult, new Date(Date.UTC(2026, 0, index + 1))]);
    for (let index = 0; index < 26; index++) await client.query(`INSERT INTO audit_log (id,actor_ref,action,resource_type,resource_id,result,request_id,correlation_id,source,occurred_at,change_summary,security_context) VALUES ($1,'seed',$2,'EXPEDIENTE',$3,'success','seed-request','seed-correlation','INTERNAL',$4,'{"private":"hidden"}','{"private":"hidden"}')`, [randomUUID(), `E2E_AUDIT_${index}`, E2E.single, new Date(Date.UTC(2026, 1, index + 1))]);
  }
}

async function main(): Promise<void> {
  await recreateDatabases();
  const router = new TenantDatabaseRouter([
    { tenantId: 'e2e-a', databaseName: databaseNames[0], connectionString: dbUrl(databaseNames[0]) },
    { tenantId: 'e2e-b', databaseName: databaseNames[1], connectionString: dbUrl(databaseNames[1]) },
  ]);
  const repository = new PostgresExpedienteRepository(router); const auditWriter = new PostgresAuditWriter(router);
  const emptyRequest: ActiveRequestQueryPort = { async findActiveByExpedienteId() { return null; } };
  const emptyLoan: ActiveLoanQueryPort = { async findActiveByExpedienteId() { return null; } };
  const emptyIncidents: OpenIncidentsQueryPort = { async findOpenByExpedienteId() { return []; } };
  const sources: ExitEnablingSourceQueryPort = { async findAvailableByExpediente(id) { return id.value === E2E.loanValid ? [{ tipo: 'CONSULTA_PROGRAMADA', validada: true }] : id.value === E2E.loanInvalid ? [{ tipo: 'VALE_ARCHIVO_SM_1_14', validada: false }] : []; } };
  const unitOfWork = new PostgresArchiveOperationsUnitOfWork(router);
  const apiModule = ExpedienteApiModule.register({
    requestContextResolver: resolver,
    getExpediente: new GetExpediente({ expedienteRepository: repository, activeRequestQuery: emptyRequest, activeLoanQuery: emptyLoan, openIncidentsQuery: emptyIncidents, exitEnablingSourceQuery: sources, capabilityService: new ExpedienteCapabilityService(), auditWriter }),
    getExpedienteTimeline: new GetExpedienteTimeline({ expedienteRepository: repository, timelineQuery: new PostgresExpedienteTimelineQueryPort(router), auditWriter }),
    getExpedienteAudit: new GetExpedienteAudit({ expedienteRepository: repository, auditQuery: new PostgresExpedienteAuditQueryPort(router) }),
    getSessionAuthorization: new GetSessionAuthorization(), listUbicaciones: new ListUbicaciones(new PostgresUbicacionesQueryPort(router)),
    searchExpedientesByNumero: new SearchExpedientesByNumero({ expedienteRepository: repository, auditWriter }),
    dispatchExpediente: new DispatchExpediente({ unitOfWork, auditWriter }), acceptCustody: new AcceptCustody({ unitOfWork, auditWriter }),
  });

  // ---------------------------------------------------------------------------
  // Agenda Preparation wiring
  // ---------------------------------------------------------------------------

  // E2E-only medico query: resolves any employee number synthetically
  const e2eMedicoQuery = {
    findByEmployeeNumber: async (numeroEmpleado: NumeroEmpleado) => ({
      kind: 'RESOLVED' as const,
      medico: MedicoReferencia.create({
        numeroEmpleado,
        nombre: 'DR E2E SINTETICO',
      }),
    }),
    findControlledFallback: async (_nombre: string) => ({ kind: 'NOT_FOUND' as const }),
  };

  // E2E-only expediente query: no expediente resolution needed for import flow
  const e2eExpedienteQuery = {
    resolve: async () => [] as const,
  };

  // E2E-only null query adapters for read use cases
  // T-18 tests focus on the import (write) path; read endpoints return empty/not-found
  const nullImportResultQuery = {
    findById: async (): Promise<AgendaImportResult | null> => null,
  };
  const nullHistoryQuery = {
    findAll: async (): Promise<AgendaImportHistoryPage> => ({ items: [], nextCursor: null }),
  };
  const nullDayQuery = {
    findByDate: async (): Promise<AgendaDayReadModel | null> => null,
  };
  const nullPreparationQuery = {
    findPage: async (): Promise<PreparationPage> => ({ items: [], nextCursor: null }),
    listForPrint: async (): Promise<readonly PreparationItem[]> => [],
  };
  const nullIncidentsQuery = {
    findByImportacionId: async (): Promise<readonly AgendaImportIncidentSummary[]> => [],
  };

  const agendaParser = new SimefAgendaParserAdapter();
  const agendaUoW = new PostgresAgendaPreparationUnitOfWork(router);
  const agendaMetadataRepo = new PostgresImportArtifactMetadataRepository(router);
  const agendaIdempotencyRepo = new PostgresIdempotencyKeyRepository(router);

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
    getAgendaDaySummary: new GetAgendaDaySummary({
      dayQuery: nullDayQuery,
      auditWriter,
    }),
    getAgendaPreparationList: new GetAgendaPreparationList({
      preparationQuery: nullPreparationQuery,
      auditWriter,
    }),
    printAgendaPreparationList: new PrintAgendaPreparationList({
      preparationQuery: nullPreparationQuery,
      auditWriter,
    }),
    getAgendaImportIncidents: new GetAgendaImportIncidents({
      incidentsQuery: nullIncidentsQuery,
      auditWriter,
    }),
  });

  @Module({ imports: [apiModule, agendaApiModule] }) class E2eModule { }
  const app = await NestFactory.create(E2eModule, { logger: false }); app.setGlobalPrefix('api/v1'); await app.listen(3000);
  async function shutdown() {
    await app.close(); await router.close();
    const admin = new Client({ connectionString: adminUrl }); await admin.connect();
    for (const name of databaseNames) {
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    }
    await admin.end(); process.exit(0);
  }
  process.on('SIGTERM', () => { void shutdown(); }); process.on('SIGINT', () => { void shutdown(); });
}

void main();
