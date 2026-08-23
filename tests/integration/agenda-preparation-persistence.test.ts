import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import {
  Agenda,
  AgendaFecha,
  Cita,
  FolioCita,
  HoraCita,
  ImportacionAgenda,
  ImportacionAgendaId,
  IncidenciaImportacion,
  IncidenciaImportacionId,
  MedicoReferencia,
  NumeroEmpleado,
  PosicionRegistroOrigen,
  RegistroImportadoAgenda,
  RegistroImportadoAgendaId,
  ServicioEspecialidad,
} from '../../packages/modules/agenda-preparation/src/index.js';
import {
  PostgresAgendaPreparationUnitOfWork,
  PostgresAgendaRepository,
  PostgresIdempotencyKeyRepository,
  PostgresImportArtifactMetadataRepository,
  PostgresImportacionAgendaRepository,
  TenantDatabaseRouter,
} from '../../packages/platform/database/src/index.js';
import type { RequestContext, TenantContext } from '../../packages/platform/tenant/src/index.js';
import { PostgresAuditWriter } from '../../packages/platform/database/src/index.js';
import type { ImportFingerprint } from '../../packages/modules/agenda-preparation/src/index.js';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Infrastructure helpers
// ---------------------------------------------------------------------------

const adminUrl =
  process.env.SIGAC_POSTGRES_ADMIN_URL ??
  'postgresql://sigac:sigac_dev_only@localhost:5432/postgres';
const suffix = randomUUID().replaceAll('-', '');
const databaseNames = [`sigac_ap_a_${suffix}`, `sigac_ap_b_${suffix}`] as const;

function databaseUrl(name: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

function tenant(index: 0 | 1): TenantContext {
  return {
    tenantId: `tenant-ap-${index + 1}`,
    slug: `hospital-ap-${index + 1}`,
    hospitalId: `hospital-ap-${index + 1}`,
    databaseName: databaseNames[index],
    timezone: 'America/Mexico_City',
  };
}

function context(index: 0 | 1): RequestContext {
  return {
    tenant: tenant(index),
    actor: {
      actorId: `actor-${index + 1}`,
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(['AGENDA_IMPORT', 'AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW']),
      tenantIds: new Set([`tenant-ap-${index + 1}`]),
    },
    requestId: `req-ap-${index + 1}`,
    correlationId: `corr-ap-${index + 1}`,
    source: 'WEB',
  };
}

async function applyMigrations(client: Client): Promise<void> {
  const directory = new URL('../../migrations/tenant/', import.meta.url);
  const files = (await readdir(directory)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, directory), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await client.query(statement);
    }
  }
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

const FECHA = AgendaFecha.parse('2026-09-01');
const FINGERPRINT: ImportFingerprint = { value: 'sha256-abc123synthetic' };
const FINGERPRINT_2: ImportFingerprint = { value: 'sha256-xyz456synthetic' };

function makeServicio(): ServicioEspecialidad {
  return ServicioEspecialidad.create({ codigo: 'CIR', nombre: 'CIRUGIA GENERAL' });
}

function makeMedico(): MedicoReferencia {
  return MedicoReferencia.create({
    numeroEmpleado: NumeroEmpleado.parse('12345'),
    nombre: 'DR MEDICO SINTETICO',
  });
}

function makeCitaSnapshot(folio: string, fecha: AgendaFecha = FECHA): Parameters<typeof Cita.create>[0] {
  return {
    folio: FolioCita.parse(folio),
    agendaFecha: fecha,
    hora: HoraCita.parse('08:00'),
    expedienteReference: null,
    nombrePaciente: 'PACIENTE SINTETICO',
    tipoDerechohabiente: 'PENSIONISTA',
    tipoConsulta: 'FIRST_TIME',
    medico: makeMedico(),
    servicioEspecialidad: makeServicio(),
  };
}

function makeFinishedImportacion(id: string, outcome: 'IMPORTED' | 'RECONCILED' = 'IMPORTED'): ImportacionAgenda {
  const importacion = ImportacionAgenda.create({
    id: ImportacionAgendaId.parse(id),
    agendaFecha: FECHA,
    importedAt: new Date('2026-09-01T10:00:00Z'),
  });
  const registroId = RegistroImportadoAgendaId.parse(randomUUID());
  const registro = RegistroImportadoAgenda.create({
    id: registroId,
    sourcePosition: PosicionRegistroOrigen.create(1),
    originalValues: {
      folio: 'FOLIO-001', patientName: 'PACIENTE SINTETICO', expedienteReference: null,
      beneficiaryType: 'PENSIONISTA', firstTimeMarker: 'X', subsequentMarker: null,
      agendaDate: '2026-09-01', appointmentTime: '08:00', physicianEmployeeNumber: '12345',
      physicianName: 'DR MEDICO SINTETICO', serviceCode: 'CIR', serviceName: 'CIRUGIA GENERAL',
    },
    interpretedValues: {
      folio: FolioCita.parse('FOLIO-001'),
      agendaFecha: FECHA,
      beneficiaryType: 'PENSIONISTA',
      appointmentKind: 'FIRST_TIME',
      appointmentTime: '08:00',
      numeroEmpleado: NumeroEmpleado.parse('12345'),
      servicioEspecialidad: makeServicio(),
    },
    resolvedReferences: { expedienteId: null, physicianReference: null },
  });
  importacion.addRegistro(registro);
  importacion.recordWithdrawnFromAgenda(0);
  importacion.finalizeRegistro(registroId, 'ADDED');
  importacion.finalize(outcome);
  return importacion;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('T-10 — Agenda Preparation PostgreSQL integration', () => {
  const admin = new Client({ connectionString: adminUrl });
  const clients = databaseNames.map((name) => new Client({ connectionString: databaseUrl(name) }));
  const router = new TenantDatabaseRouter([
    {
      tenantId: 'tenant-ap-1',
      databaseName: databaseNames[0],
      connectionString: databaseUrl(databaseNames[0]),
    },
    {
      tenantId: 'tenant-ap-2',
      databaseName: databaseNames[1],
      connectionString: databaseUrl(databaseNames[1]),
    },
  ]);

  beforeAll(async () => {
    await admin.connect();
    for (const name of databaseNames) await admin.query(`CREATE DATABASE "${name}"`);
    for (const client of clients) {
      await client.connect();
      await applyMigrations(client);
    }
  }, 30_000);

  afterAll(async () => {
    await router.close();
    for (const client of clients) await client.end();
    for (const name of databaseNames) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }, 30_000);

  // -------------------------------------------------------------------------
  // Schema validation
  // -------------------------------------------------------------------------

  it('migration 0002 crea las siete tablas con columnas canónicas', async () => {
    const tables = await clients[0]!.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (
           'agenda_imports', 'agendas', 'citas',
           'agenda_registros', 'agenda_incidencias',
           'agenda_artifact_metadata', 'agenda_idempotency_keys'
         )
       ORDER BY table_name`,
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      'agenda_artifact_metadata', 'agenda_idempotency_keys', 'agenda_imports',
      'agenda_incidencias', 'agenda_registros', 'agendas', 'citas',
    ]);

    // agenda_imports must NOT have fingerprint or filename
    const importCols = await clients[0]!.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'agenda_imports' ORDER BY column_name`,
    );
    const importColNames = importCols.rows.map((r) => r.column_name);
    expect(importColNames).not.toContain('fingerprint');
    expect(importColNames).not.toContain('filename');
    expect(importColNames).not.toContain('raw_row');
    expect(importColNames).toContain('received_records');
    expect(importColNames).toContain('withdrawn_from_agenda');

    // citas must NOT have turno/consultorio/destino/curp
    const citaCols = await clients[0]!.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'citas'`,
    );
    const citaColNames = citaCols.rows.map((r) => r.column_name);
    expect(citaColNames).not.toContain('turno');
    expect(citaColNames).not.toContain('consultorio');
    expect(citaColNames).not.toContain('destino');
    expect(citaColNames).not.toContain('curp');
  });

  it('CHECK constraints rechazan valores fuera del catálogo aprobado', async () => {
    // outcome invalid
    await expect(
      clients[0]!.query(
        `INSERT INTO agenda_imports (id, agenda_date, imported_at, outcome)
         VALUES ($1, '2026-09-01', now(), 'UNKNOWN_OUTCOME')`,
        [randomUUID()],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    // processing_result invalid
    const importId = randomUUID();
    await clients[0]!.query(
      `INSERT INTO agenda_imports (id, agenda_date, imported_at, outcome)
       VALUES ($1, '2026-09-01', now(), 'IMPORTED')`, [importId],
    );
    await expect(
      clients[0]!.query(
        `INSERT INTO agenda_registros
           (id, importacion_id, source_position, processing_result)
           VALUES ($1, $2, 1, 'INVALID_RESULT')`,
        [randomUUID(), importId],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    // incident_type invalid
    const registroId = randomUUID();
    await clients[0]!.query(
      `INSERT INTO agenda_registros
         (id, importacion_id, source_position, processing_result)
         VALUES ($1, $2, 1, 'ADDED')`, [registroId, importId],
    );
    await expect(
      clients[0]!.query(
        `INSERT INTO agenda_incidencias
           (id, importacion_id, registro_id, source_position, incident_type)
           VALUES ($1, $2, $3, 1, 'NOT_A_VALID_INCIDENT')`,
        [randomUUID(), importId, registroId],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    // lifecycle invalid
    await clients[0]!.query(
      `INSERT INTO agendas (agenda_date) VALUES ('2099-01-01')`,
    );
    await expect(
      clients[0]!.query(
        `INSERT INTO citas
           (agenda_date, folio, hora, nombre_paciente, tipo_derechohabiente,
            tipo_consulta, medico_numero_empleado, medico_nombre,
            servicio_codigo, servicio_nombre, lifecycle)
           VALUES ('2099-01-01', 'F-BAD', '08:00', 'N', 'T',
                   'FIRST_TIME', '99', 'DR', 'S', 'S', 'CANCELLED')`,
      ),
    ).rejects.toMatchObject({ code: '23514' });

    // tipo_consulta invalid
    await expect(
      clients[0]!.query(
        `INSERT INTO citas
           (agenda_date, folio, hora, nombre_paciente, tipo_derechohabiente,
            tipo_consulta, medico_numero_empleado, medico_nombre,
            servicio_codigo, servicio_nombre, lifecycle)
           VALUES ('2099-01-01', 'F-BAD2', '08:00', 'N', 'T',
                   'THIRD_TIME', '99', 'DR', 'S', 'S', 'ACTIVA')`,
      ),
    ).rejects.toMatchObject({ code: '23514' });

    // source_position <= 0
    await expect(
      clients[0]!.query(
        `INSERT INTO agenda_registros
           (id, importacion_id, source_position, processing_result)
           VALUES ($1, $2, 0, 'ADDED')`,
        [randomUUID(), importId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('FK rechaza registro huérfano', async () => {
    await expect(
      clients[0]!.query(
        `INSERT INTO agenda_registros
           (id, importacion_id, source_position, processing_result)
           VALUES ($1, $2, 1, 'ADDED')`,
        [randomUUID(), 'aaaaaaaa-0000-4000-8000-000000000000'],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  // -------------------------------------------------------------------------
  // ImportacionAgenda round-trip
  // -------------------------------------------------------------------------

  it('persiste ImportacionAgenda y la recupera por FK (round-trip básico)', async () => {
    const id = randomUUID();
    const importacion = makeFinishedImportacion(id);
    const repository = new PostgresImportacionAgendaRepository(router);
    await repository.save(importacion, tenant(0));

    const rows = await clients[0]!.query<{ outcome: string; received_records: number }>(
      `SELECT outcome, received_records FROM agenda_imports WHERE id = $1`, [id],
    );
    expect(rows.rows[0]).toMatchObject({ outcome: 'IMPORTED', received_records: 1 });

    const registroRows = await clients[0]!.query<{
      source_position: number;
      processing_result: string;
      orig_patient_name: string;
      interp_folio: string;
    }>(
      `SELECT source_position, processing_result, orig_patient_name, interp_folio
       FROM agenda_registros WHERE importacion_id = $1`, [id],
    );
    expect(registroRows.rows).toHaveLength(1);
    expect(registroRows.rows[0]).toMatchObject({
      source_position: 1,
      processing_result: 'ADDED',
      orig_patient_name: 'PACIENTE SINTETICO',
      interp_folio: 'FOLIO-001',
    });
  });

  it('persiste ImportacionAgenda con incidencia PENDING_REVIEW', async () => {
    const importId = randomUUID();
    const importacion = ImportacionAgenda.create({
      id: ImportacionAgendaId.parse(importId),
      agendaFecha: FECHA,
      importedAt: new Date('2026-09-01T10:30:00Z'),
    });
    const registroId = RegistroImportadoAgendaId.parse(randomUUID());
    const registro = RegistroImportadoAgenda.create({
      id: registroId,
      sourcePosition: PosicionRegistroOrigen.create(1),
      originalValues: {
        folio: 'F-PENDING', patientName: 'P', expedienteReference: null,
        beneficiaryType: 'A', firstTimeMarker: null, subsequentMarker: null,
        agendaDate: '2026-09-01', appointmentTime: '09:00',
        physicianEmployeeNumber: '99999', physicianName: 'DR UNKNOWN',
        serviceCode: 'S', serviceName: 'SVC',
      },
      interpretedValues: {
        folio: null, agendaFecha: null, beneficiaryType: null,
        appointmentKind: null, appointmentTime: null,
        numeroEmpleado: null, servicioEspecialidad: null,
      },
      resolvedReferences: { expedienteId: null, physicianReference: null },
    });
    const incidenciaId = IncidenciaImportacionId.parse(randomUUID());
    const incidencia = IncidenciaImportacion.create({
      id: incidenciaId,
      registroId,
      sourcePosition: PosicionRegistroOrigen.create(1),
      type: 'PHYSICIAN_NOT_RESOLVED',
    });
    importacion.addRegistro(registro);
    importacion.addIncidencia(incidencia);
    importacion.recordWithdrawnFromAgenda(0);
    importacion.finalizeRegistro(registroId, 'PENDING_REVIEW');
    importacion.finalize('IMPORTED');

    const repository = new PostgresImportacionAgendaRepository(router);
    await repository.save(importacion, tenant(0));

    const incRows = await clients[0]!.query<{ incident_type: string }>(
      `SELECT incident_type FROM agenda_incidencias WHERE importacion_id = $1`, [importId],
    );
    expect(incRows.rows).toHaveLength(1);
    expect(incRows.rows[0]!.incident_type).toBe('PHYSICIAN_NOT_RESOLVED');
  });

  // -------------------------------------------------------------------------
  // Agenda / Cita round-trip
  // -------------------------------------------------------------------------

  it('persiste Agenda con Citas ACTIVA y RETIRADA_DE_AGENDA (lifecycle preservada)', async () => {
    const agendaRepo = new PostgresAgendaRepository(router);

    // Create Agenda with 2 citas
    const fecha0902 = AgendaFecha.parse('2026-09-02');
    const agenda = Agenda.create({
      fecha: fecha0902,
      citasIniciales: [
        Cita.create(makeCitaSnapshot('FOLIO-A', fecha0902)),
        Cita.create(makeCitaSnapshot('FOLIO-B', fecha0902)),
      ],
    });
    await agendaRepo.save(agenda, tenant(0));

    // Verify both ACTIVA
    let citaRows = await clients[0]!.query<{ folio: string; lifecycle: string }>(
      `SELECT folio, lifecycle FROM citas WHERE agenda_date = '2026-09-02' ORDER BY folio`,
    );
    expect(citaRows.rows).toHaveLength(2);
    expect(citaRows.rows.every((r) => r.lifecycle === 'ACTIVA')).toBe(true);

    // Reconcile: only FOLIO-A incoming → FOLIO-B becomes RETIRADA
    agenda.reconcile({ incoming: [makeCitaSnapshot('FOLIO-A', fecha0902)] });
    await agendaRepo.save(agenda, tenant(0));

    citaRows = await clients[0]!.query<{ folio: string; lifecycle: string }>(
      `SELECT folio, lifecycle FROM citas WHERE agenda_date = '2026-09-02' ORDER BY folio`,
    );
    expect(citaRows.rows).toHaveLength(2); // RETIRADA is preserved, not deleted
    const folioA = citaRows.rows.find((r) => r.folio === 'FOLIO-A');
    const folioB = citaRows.rows.find((r) => r.folio === 'FOLIO-B');
    expect(folioA!.lifecycle).toBe('ACTIVA');
    expect(folioB!.lifecycle).toBe('RETIRADA_DE_AGENDA');
  });

  it('rehydrata Agenda con RETIRADA y RESTORE conserva identidad FOLIO', async () => {
    const agendaRepo = new PostgresAgendaRepository(router);
    const fecha = AgendaFecha.parse('2026-09-03');

    // Step 1: create with FOLIO-X
    const agenda1 = Agenda.create({ fecha, citasIniciales: [Cita.create(makeCitaSnapshot('FOLIO-X', fecha))] });
    await agendaRepo.save(agenda1, tenant(0));

    // Step 2: reconcile empty → FOLIO-X withdrawn
    agenda1.reconcile({ incoming: [] });
    await agendaRepo.save(agenda1, tenant(0));

    // Step 3: rehydrate and verify RETIRADA
    const rehydrated = await agendaRepo.findByFecha(fecha, tenant(0));
    expect(rehydrated).not.toBeNull();
    const foliox = rehydrated!.citas.find((c) => c.folio.value === 'FOLIO-X');
    expect(foliox!.lifecycle).toBe('RETIRADA_DE_AGENDA');

    // Step 4: RESTORE — reconcile with FOLIO-X again
    rehydrated!.reconcile({ incoming: [makeCitaSnapshot('FOLIO-X', fecha)] });
    await agendaRepo.save(rehydrated!, tenant(0));

    const restored = await agendaRepo.findByFecha(fecha, tenant(0));
    const folioxRestored = restored!.citas.find((c) => c.folio.value === 'FOLIO-X');
    expect(folioxRestored!.lifecycle).toBe('ACTIVA');
  });

  it('findByFecha retorna null si no existe la Agenda', async () => {
    const agendaRepo = new PostgresAgendaRepository(router);
    const result = await agendaRepo.findByFecha(AgendaFecha.parse('2099-12-31'), tenant(0));
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Fingerprint metadata (fingerprint outside Domain)
  // -------------------------------------------------------------------------

  it('agenda_artifact_metadata: findEquivalent retorna la más reciente y no viola unicidad', async () => {
    const metaRepo = new PostgresImportArtifactMetadataRepository(router);
    const id1 = randomUUID();
    const id2 = randomUUID();

    // Persist two imports with same fingerprint
    await clients[0]!.query(
      `INSERT INTO agenda_imports (id, agenda_date, imported_at, outcome)
       VALUES ($1, '2026-09-04', '2026-09-04T08:00:00Z', 'IMPORTED'),
              ($2, '2026-09-04', '2026-09-04T09:00:00Z', 'ALREADY_IMPORTED')`,
      [id1, id2],
    );

    // Associate both with same fingerprint
    const fingerprint: ImportFingerprint = { value: 'sha256-same-fingerprint' };
    await metaRepo.associateConfirmedImport({
      importacionId: ImportacionAgendaId.parse(id1),
      agendaDate: AgendaFecha.parse('2026-09-04'),
      fingerprint,
    }, tenant(0));
    // For second insert, use raw SQL since associateConfirmedImport reads imported_at from agenda_imports
    await clients[0]!.query(
      `INSERT INTO agenda_artifact_metadata (id, importacion_id, agenda_date, fingerprint, imported_at)
       VALUES ($1, $2, '2026-09-04', 'sha256-same-fingerprint', '2026-09-04T09:00:00Z')`,
      [randomUUID(), id2],
    );

    const equiv = await metaRepo.findEquivalent({
      agendaDate: AgendaFecha.parse('2026-09-04'),
      fingerprint,
    }, tenant(0));

    // Should return the most recent (id2 has later imported_at)
    expect(equiv).not.toBeNull();
    expect(equiv!.importacionId.value).toBe(id2);
  });

  it('fingerprint está separado de agenda_imports (NO en la tabla canónica)', async () => {
    const importCols = await clients[0]!.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'agenda_imports'`,
    );
    expect(importCols.rows.map((r) => r.column_name)).not.toContain('fingerprint');

    const metaCols = await clients[0]!.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'agenda_artifact_metadata'`,
    );
    expect(metaCols.rows.map((r) => r.column_name)).toContain('fingerprint');
  });

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  it('agenda_idempotency_keys: findByKey/recordKey — misma key + mismo artefacto', async () => {
    const idemRepo = new PostgresIdempotencyKeyRepository(router);
    const key = `idem-key-${randomUUID()}`;
    const importId = randomUUID();

    // Setup: create the import first
    await clients[0]!.query(
      `INSERT INTO agenda_imports (id, agenda_date, imported_at, outcome)
       VALUES ($1, '2026-09-05', now(), 'IMPORTED')`, [importId],
    );

    // findByKey returns null before recording
    const before = await idemRepo.findByKey(key, tenant(0));
    expect(before).toBeNull();

    // Record the key
    await idemRepo.recordKey(key, ImportacionAgendaId.parse(importId), tenant(0));

    // findByKey returns the importacionId
    const after = await idemRepo.findByKey(key, tenant(0));
    expect(after).not.toBeNull();
    expect(after!.importacionId.value).toBe(importId);

    // Same key → same importId → replay (ALREADY_IMPORTED semantics)
    const again = await idemRepo.findByKey(key, tenant(0));
    expect(again!.importacionId.value).toBe(importId);
  });

  it('idempotency key is tenant-scoped — tenant B cannot see tenant A key', async () => {
    const idemRepo = new PostgresIdempotencyKeyRepository(router);
    const key = `cross-tenant-key-${randomUUID()}`;
    const importId = randomUUID();
    await clients[0]!.query(
      `INSERT INTO agenda_imports (id, agenda_date, imported_at, outcome)
       VALUES ($1, '2026-09-05', now(), 'IMPORTED')`, [importId],
    );
    await idemRepo.recordKey(key, ImportacionAgendaId.parse(importId), tenant(0));

    // tenant B cannot see tenant A's key
    const fromB = await idemRepo.findByKey(key, tenant(1));
    expect(fromB).toBeNull();
  });

  // -------------------------------------------------------------------------
  // UnitOfWork atomicidad y rollback
  // -------------------------------------------------------------------------

  it('UoW commite ImportacionAgenda + Agenda/Citas + metadata + idempotency + audit en una transacción', async () => {
    const uow = new PostgresAgendaPreparationUnitOfWork(router);
    const importId = randomUUID();
    const key = `uow-key-${randomUUID()}`;
    const fecha = AgendaFecha.parse('2026-09-10');

    await uow.execute(tenant(0), async (tx) => {
      // Persist ImportacionAgenda
      const importacion = makeFinishedImportacion(importId);
      await tx.importacionAgendaRepository.save(importacion, tenant(0));

      // Persist Agenda + Cita
      const agenda = Agenda.create({ fecha, citasIniciales: [Cita.create(makeCitaSnapshot('FOLIO-UOW', fecha))] });
      await tx.agendaRepository.save(agenda, tenant(0));

      // Associate metadata
      await tx.importArtifactMetadataRepository.associateConfirmedImport({
        importacionId: importacion.id,
        agendaDate: fecha,
        fingerprint: FINGERPRINT,
      }, tenant(0));

      // Record idempotency key
      await tx.idempotencyKeyRepository.recordKey(key, importacion.id, tenant(0));

      // Audit success
      await tx.auditWriter.append({
        action: 'AGENDA_IMPORT',
        resourceType: 'AGENDA_IMPORT',
        resourceId: importId,
        result: 'success',
      }, context(0));
    });

    // All 5 writes are committed
    const importRow = await clients[0]!.query(`SELECT outcome FROM agenda_imports WHERE id = $1`, [importId]);
    expect(importRow.rows[0]!.outcome).toBe('IMPORTED');

    const citaRow = await clients[0]!.query(`SELECT lifecycle FROM citas WHERE folio = 'FOLIO-UOW' AND agenda_date = '2026-09-10'`);
    expect(citaRow.rows[0]!.lifecycle).toBe('ACTIVA');

    const metaRow = await clients[0]!.query(
      `SELECT fingerprint FROM agenda_artifact_metadata WHERE importacion_id = $1`, [importId],
    );
    expect(metaRow.rows[0]!.fingerprint).toBe(FINGERPRINT.value);

    const idemRow = await clients[0]!.query(
      `SELECT importacion_id FROM agenda_idempotency_keys WHERE idempotency_key = $1`, [key],
    );
    expect(idemRow.rows[0]!.importacion_id).toBe(importId);

    const auditRow = await clients[0]!.query(`SELECT result FROM audit_log WHERE resource_id = $1`, [importId]);
    expect(auditRow.rows[0]!.result).toBe('success');
  });

  it('UoW hace ROLLBACK total si una operación falla dentro de la transacción', async () => {
    const uow = new PostgresAgendaPreparationUnitOfWork(router);
    const importId = randomUUID();

    await expect(
      uow.execute(tenant(0), async (tx) => {
        const importacion = makeFinishedImportacion(importId);
        await tx.importacionAgendaRepository.save(importacion, tenant(0));
        // Force failure: FK violation — metadata points to non-existent import
        await tx.importArtifactMetadataRepository.associateConfirmedImport(
          {
            importacionId: ImportacionAgendaId.parse('aaaaaaaa-0000-4000-8000-000000000000'),
            agendaDate: AgendaFecha.parse('2026-09-11'),
            fingerprint: FINGERPRINT,
          },
          tenant(0),
        );
      }),
    ).rejects.toThrow();

    // ROLLBACK: importacion must NOT exist
    const importRow = await clients[0]!.query(`SELECT id FROM agenda_imports WHERE id = $1`, [importId]);
    expect(importRow.rows).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it('tenant A no puede ver los datos de tenant B', async () => {
    const importIdA = randomUUID();
    const importIdB = randomUUID();
    const importRepo = new PostgresImportacionAgendaRepository(router);

    await importRepo.save(makeFinishedImportacion(importIdA), tenant(0));
    await importRepo.save(makeFinishedImportacion(importIdB), tenant(1));

    // Tenant B's database has only its own import
    const rowsInB = await clients[1]!.query<{ id: string }>(
      `SELECT id FROM agenda_imports`,
    );
    expect(rowsInB.rows.map((r) => r.id)).toContain(importIdB);
    expect(rowsInB.rows.map((r) => r.id)).not.toContain(importIdA);

    // AgendaRepository: tenant B cannot see tenant A's agenda
    const agendaRepo = new PostgresAgendaRepository(router);
    await agendaRepo.save(
      Agenda.create({ fecha: AgendaFecha.parse('2026-09-20'), citasIniciales: [] }),
      tenant(0),
    );
    const notFound = await agendaRepo.findByFecha(AgendaFecha.parse('2026-09-20'), tenant(1));
    expect(notFound).toBeNull();
  });

  it('audit_log es tenant-local: tenant A y B tienen logs independientes', async () => {
    const writer = new PostgresAuditWriter(router);
    await writer.append(
      { action: 'AGENDA_VIEW', resourceType: 'AGENDA_IMPORT', resourceId: 'res-a', result: 'success' },
      context(0),
    );
    const countB = await clients[1]!.query(`SELECT count(*) FROM audit_log WHERE resource_id = 'res-a'`);
    expect(countB.rows[0]!.count).toBe('0');
  });

  // -------------------------------------------------------------------------
  // Privacy: no prohibited columns
  // -------------------------------------------------------------------------

  it('ninguna tabla persiste columnas de datos personales prohibidos', async () => {
    const prohibitedCols = ['curp', 'telefono', 'sexo', 'edad', 'vigencia', 'raw_row', 'filename', 'turno', 'consultorio', 'destino', 'tenant_id'];
    const result = await clients[0]!.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN (
           'agenda_imports', 'agendas', 'citas',
           'agenda_registros', 'agenda_incidencias',
           'agenda_artifact_metadata', 'agenda_idempotency_keys'
         )`,
    );
    const actualCols = result.rows.map((r) => r.column_name);
    for (const col of prohibitedCols) {
      expect(actualCols, `columna prohibida: ${col}`).not.toContain(col);
    }
  });
});
