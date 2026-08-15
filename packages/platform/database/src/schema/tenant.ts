import { bigint, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const expedientes = pgTable('expedientes', {
  id: uuid('id').primaryKey(),
  expedienteNumero: text('expediente_numero').notNull().unique(),
  pacienteRef: text('paciente_ref'),
  pacienteNombreBusqueda: text('paciente_nombre_busqueda'),
  estadoOperativo: text('estado_operativo').notNull(),
  ubicacionActualId: uuid('ubicacion_actual_id'),
  custodioRef: text('custodio_ref'),
  rowVersion: bigint('row_version', { mode: 'number' }).notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
