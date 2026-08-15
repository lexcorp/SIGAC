import { sql } from 'drizzle-orm';
import { bigint, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
