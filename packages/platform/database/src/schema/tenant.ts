import { sql } from 'drizzle-orm';
import { bigint, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const ubicaciones = pgTable('ubicaciones', {
  id: uuid('id').primaryKey(),
  codigo: text('codigo').notNull(),
  descripcion: text('descripcion').notNull(),
});

export const expedientes = pgTable(
  'expedientes',
  {
    id: uuid('id').primaryKey(),
    expedienteNumero: text('expediente_numero').notNull(),
    expedienteNumeroNormalizado: text('expediente_numero_normalizado').notNull(),
    pacienteIdInstitucional: text('paciente_id_institucional').notNull(),
    pacienteCurp: text('paciente_curp').notNull(),
    pacienteNombreOperativo: text('paciente_nombre_operativo').notNull(),
    pacienteNumeroIssste: text('paciente_numero_issste').notNull(),
    estadoOperativo: text('estado_operativo').notNull(),
    ubicacionActualId: uuid('ubicacion_actual_id').references(() => ubicaciones.id),
    custodioTipo: text('custodio_tipo'),
    custodioRef: text('custodio_ref'),
    custodioServicio: text('custodio_servicio'),
    custodioLocation: text('custodio_location'),
    custodioAcceptedAt: timestamp('custodio_accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rowVersion: bigint('row_version', { mode: 'bigint' }).notNull().default(sql`0`),
  },
  (table) => [
    index('expedientes_numero_normalizado_idx').on(table.expedienteNumeroNormalizado),
    check(
      'expedientes_estado_operativo_check',
      sql`${table.estadoOperativo} IN ('DISPONIBLE', 'APARTADO', 'EN_TRASLADO', 'EN_CONSULTA', 'NO_LOCALIZADO', 'EXTRAVIADO')`,
    ),
  ],
);

export const movimientosExpediente = pgTable(
  'movimientos_expediente',
  {
    id: uuid('id').primaryKey(),
    expedienteId: uuid('expediente_id')
      .notNull()
      .references(() => expedientes.id),
    movementType: text('movement_type').notNull(),
    originLocationId: uuid('origin_location_id'),
    destinationLocationId: uuid('destination_location_id'),
    originCustodianRef: text('origin_custodian_ref'),
    destinationCustodianRef: text('destination_custodian_ref'),
    businessReferenceType: text('business_reference_type').notNull(),
    businessReferenceId: text('business_reference_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    actorRef: text('actor_ref').notNull(),
    source: text('source').notNull(),
    correlationId: text('correlation_id'),
  },
  (table) => [
    check('movimientos_expediente_source_check', sql`${table.source} IN ('WEB', 'INTERNAL')`),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey(),
    actorRef: text('actor_ref').notNull(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    result: text('result').notNull(),
    requestId: text('request_id').notNull(),
    correlationId: text('correlation_id').notNull(),
    source: text('source').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    changeSummary: jsonb('change_summary').$type<Readonly<Record<string, string>>>(),
    securityContext: jsonb('security_context').$type<Readonly<Record<string, unknown>>>(),
  },
  (table) => [
    check(
      'audit_log_result_check',
      sql`${table.result} IN ('success', 'denied', 'not-found', 'conflict', 'invalid-transition')`,
    ),
    check('audit_log_source_check', sql`${table.source} IN ('WEB', 'INTERNAL')`),
  ],
);

// -------------------------------------------------------------------------
// Agenda Preparation — PHY-AP-003
// -------------------------------------------------------------------------
export const agendas = pgTable('agendas', {
  agendaDate: text('agenda_date').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// -------------------------------------------------------------------------
// Agenda Preparation — PHY-AP-004
// -------------------------------------------------------------------------
export const citas = pgTable(
  'citas',
  {
    agendaDate: text('agenda_date')
      .notNull()
      .references(() => agendas.agendaDate),
    folio: text('folio').notNull(),
    hora: text('hora').notNull(),
    expedienteReference: text('expediente_reference'),
    nombrePaciente: text('nombre_paciente').notNull(),
    tipoDerechohabiente: text('tipo_derechohabiente').notNull(),
    tipoConsulta: text('tipo_consulta').notNull(),
    medicoNumeroEmpleado: text('medico_numero_empleado').notNull(),
    medicoNombre: text('medico_nombre').notNull(),
    servicioCodigo: text('servicio_codigo').notNull(),
    servicioNombre: text('servicio_nombre').notNull(),
    lifecycle: text('lifecycle').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.agendaDate, table.folio], name: 'citas_pkey' }),
    check('citas_tipo_consulta_check', sql`${table.tipoConsulta} IN ('FIRST_TIME', 'SUBSEQUENT')`),
    check('citas_lifecycle_check', sql`${table.lifecycle} IN ('ACTIVA', 'RETIRADA_DE_AGENDA')`),
    index('citas_agenda_date_lifecycle_idx').on(table.agendaDate, table.lifecycle),
    index('citas_agenda_date_servicio_idx').on(
      table.agendaDate, table.lifecycle, table.servicioCodigo, table.servicioNombre,
      table.medicoNombre, table.medicoNumeroEmpleado, table.hora, table.folio,
    ),
  ],
);

// -------------------------------------------------------------------------
// Agenda Preparation — PHY-AP-002
// -------------------------------------------------------------------------
export const agendaImports = pgTable(
  'agenda_imports',
  {
    id: uuid('id').primaryKey(),
    agendaDate: text('agenda_date').notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull(),
    outcome: text('outcome').notNull(),
    receivedRecords: integer('received_records').notNull().default(0),
    processed: integer('processed').notNull().default(0),
    added: integer('added').notNull().default(0),
    updated: integer('updated').notNull().default(0),
    unchanged: integer('unchanged').notNull().default(0),
    restored: integer('restored').notNull().default(0),
    pendingReview: integer('pending_review').notNull().default(0),
    rejected: integer('rejected').notNull().default(0),
    duplicateFolio: integer('duplicate_folio').notNull().default(0),
    withdrawnFromAgenda: integer('withdrawn_from_agenda').notNull().default(0),
    incidents: integer('incidents').notNull().default(0),
    errors: integer('errors').notNull().default(0),
  },
  (table) => [
    check(
      'agenda_imports_outcome_check',
      sql`${table.outcome} IN ('IMPORTED', 'ALREADY_IMPORTED', 'RECONCILED')`,
    ),
    index('agenda_imports_imported_at_id_idx').on(table.importedAt, table.id),
    index('agenda_imports_agenda_date_idx').on(table.agendaDate),
  ],
);

// -------------------------------------------------------------------------
// Agenda Preparation — PHY-AP-005
// -------------------------------------------------------------------------
export const agendaRegistros = pgTable(
  'agenda_registros',
  {
    id: uuid('id').primaryKey(),
    importacionId: uuid('importacion_id')
      .notNull()
      .references(() => agendaImports.id),
    sourcePosition: integer('source_position').notNull(),
    processingResult: text('processing_result').notNull(),
    // originalValues (allow-list per RAW-AP-004)
    origFolio: text('orig_folio'),
    origPatientName: text('orig_patient_name'),
    origExpedienteReference: text('orig_expediente_reference'),
    origBeneficiaryType: text('orig_beneficiary_type'),
    origFirstTimeMarker: text('orig_first_time_marker'),
    origSubsequentMarker: text('orig_subsequent_marker'),
    origAgendaDate: text('orig_agenda_date'),
    origAppointmentTime: text('orig_appointment_time'),
    origPhysicianEmployeeNumber: text('orig_physician_employee_number'),
    origPhysicianName: text('orig_physician_name'),
    origServiceCode: text('orig_service_code'),
    origServiceName: text('orig_service_name'),
    // interpretedValues
    interpFolio: text('interp_folio'),
    interpAgendaDate: text('interp_agenda_date'),
    interpBeneficiaryType: text('interp_beneficiary_type'),
    interpAppointmentKind: text('interp_appointment_kind'),
    interpAppointmentTime: text('interp_appointment_time'),
    interpNumeroEmpleado: text('interp_numero_empleado'),
    interpServicioCodigo: text('interp_servicio_codigo'),
    interpServicioNombre: text('interp_servicio_nombre'),
    // resolvedReferences
    resolvedExpedienteId: text('resolved_expediente_id'),
    resolvedPhysicianReference: text('resolved_physician_reference'),
  },
  (table) => [
    check('agenda_registros_source_position_check', sql`${table.sourcePosition} > 0`),
    check(
      'agenda_registros_processing_result_check',
      sql`${table.processingResult} IN ('ADDED','UPDATED','UNCHANGED','RESTORED','PENDING_REVIEW','REJECTED','DUPLICATE_FOLIO')`,
    ),
    check(
      'agenda_registros_interp_appointment_kind_check',
      sql`${table.interpAppointmentKind} IS NULL OR ${table.interpAppointmentKind} IN ('FIRST_TIME','SUBSEQUENT')`,
    ),
    index('agenda_registros_importacion_id_idx').on(table.importacionId),
    index('agenda_registros_importacion_source_idx').on(table.importacionId, table.sourcePosition, table.id),
  ],
);

// -------------------------------------------------------------------------
// Agenda Preparation — PHY-AP-006
// -------------------------------------------------------------------------
export const agendaIncidencias = pgTable(
  'agenda_incidencias',
  {
    id: uuid('id').primaryKey(),
    importacionId: uuid('importacion_id')
      .notNull()
      .references(() => agendaImports.id),
    registroId: uuid('registro_id')
      .notNull()
      .references(() => agendaRegistros.id),
    sourcePosition: integer('source_position').notNull(),
    incidentType: text('incident_type').notNull(),
  },
  (table) => [
    check(
      'agenda_incidencias_incident_type_check',
      sql`${table.incidentType} IN ('PHYSICIAN_NOT_RESOLVED','PHYSICIAN_AMBIGUOUS','SERVICE_NOT_RESOLVED','EXPEDIENT_NOT_RESOLVED','REQUIRED_DATA_MISSING','ROW_INCONSISTENT','DUPLICATE_FOLIO_IN_SNAPSHOT')`,
    ),
    index('agenda_incidencias_importacion_id_idx').on(table.importacionId),
    index('agenda_incidencias_importacion_source_idx').on(table.importacionId, table.sourcePosition, table.id),
  ],
);

// -------------------------------------------------------------------------
// Agenda Preparation — PHY-AP-007
// -------------------------------------------------------------------------
export const agendaArtifactMetadata = pgTable(
  'agenda_artifact_metadata',
  {
    id: uuid('id').primaryKey(),
    importacionId: uuid('importacion_id')
      .notNull()
      .references(() => agendaImports.id),
    agendaDate: text('agenda_date').notNull(),
    fingerprint: text('fingerprint').notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('agenda_artifact_metadata_date_fp_idx').on(
      table.agendaDate, table.fingerprint, table.importedAt, table.importacionId,
    ),
  ],
);

// -------------------------------------------------------------------------
// Agenda Preparation — PHY-AP-008
// -------------------------------------------------------------------------
export const agendaIdempotencyKeys = pgTable(
  'agenda_idempotency_keys',
  {
    idempotencyKey: text('idempotency_key').primaryKey(),
    importacionId: uuid('importacion_id')
      .notNull()
      .references(() => agendaImports.id),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
);
