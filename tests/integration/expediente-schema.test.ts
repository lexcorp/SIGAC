import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const adminConnectionString =
  process.env.SIGAC_POSTGRES_ADMIN_URL ??
  'postgresql://sigac:sigac_dev_only@localhost:5432/postgres';
const migrationUrl = new URL('../../migrations/tenant/0000_tan_quicksilver.sql', import.meta.url);

describe('expediente-workspace tenant migration', () => {
  const databaseName = `sigac_migration_${randomUUID().replaceAll('-', '')}`;
  const databaseUrl = new URL(adminConnectionString);
  databaseUrl.pathname = `/${databaseName}`;
  const admin = new Client({ connectionString: adminConnectionString });
  const client = new Client({ connectionString: databaseUrl.toString() });

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    await client.connect();
    const migration = await readFile(migrationUrl, 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim().length > 0) await client.query(statement);
    }
  });

  afterAll(async () => {
    await client.end();
    await admin.query(`DROP DATABASE "${databaseName}"`);
    await admin.end();
  }, 30_000);

  it('crea sólo las columnas y nullability aprobadas', async () => {
    const result = await client.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
      column_default: string | null;
    }>(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('ubicaciones', 'expedientes', 'movimientos_expediente')
      ORDER BY table_name, ordinal_position
    `);

    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: 'expedientes',
          column_name: 'paciente_id_institucional',
          data_type: 'text',
          is_nullable: 'NO',
        }),
        expect.objectContaining({
          table_name: 'expedientes',
          column_name: 'custodio_location',
          data_type: 'text',
          is_nullable: 'YES',
        }),
        expect.objectContaining({
          table_name: 'expedientes',
          column_name: 'row_version',
          data_type: 'bigint',
          is_nullable: 'NO',
          column_default: '0',
        }),
        expect.objectContaining({
          table_name: 'movimientos_expediente',
          column_name: 'business_reference_id',
          data_type: 'text',
          is_nullable: 'YES',
        }),
        expect.objectContaining({
          table_name: 'movimientos_expediente',
          column_name: 'correlation_id',
          data_type: 'text',
          is_nullable: 'YES',
        }),
      ]),
    );
    expect(result.rows.some((column) => column.column_name === 'hospital_id')).toBe(false);
    expect(result.rows.some((column) => column.column_name === 'origin_location')).toBe(false);
    expect(result.rows.some((column) => column.column_name === 'destination_location')).toBe(false);
  });

  it('mantiene expediente_numero no unique y crea el índice normalizado no unique', async () => {
    const constraints = await client.query<{ constraint_name: string }>(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'expedientes'
        AND constraint_type = 'UNIQUE'
    `);
    const indexes = await client.query<{ indexname: string; indexdef: string }>(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'expedientes'
    `);

    expect(constraints.rows).toEqual([]);
    expect(indexes.rows).toContainEqual({
      indexname: 'expedientes_numero_normalizado_idx',
      indexdef: expect.not.stringContaining('UNIQUE'),
    });
  });

  it('aplica los CHECK exactos de EstadoOperativo y RequestSource', async () => {
    const checks = await client.query<{ constraint_name: string; check_clause: string }>(`
      SELECT tc.constraint_name, cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON cc.constraint_schema = tc.constraint_schema
       AND cc.constraint_name = tc.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.constraint_name IN (
          'expedientes_estado_operativo_check',
          'movimientos_expediente_source_check'
        )
      ORDER BY tc.constraint_name
    `);

    expect(checks.rows).toHaveLength(2);
    expect(checks.rows.find((row) => row.constraint_name === 'expedientes_estado_operativo_check'))
      .toEqual(expect.objectContaining({ check_clause: expect.stringContaining('EXTRAVIADO') }));
    expect(checks.rows.find((row) => row.constraint_name === 'movimientos_expediente_source_check'))
      .toEqual(expect.objectContaining({ check_clause: expect.stringContaining('INTERNAL') }));
  });

  it('crea únicamente las dos FKs aprobadas', async () => {
    const result = await client.query<{
      table_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>(`
      SELECT tc.table_name, kcu.column_name,
             ccu.table_name AS foreign_table_name,
             ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
       AND kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_schema = tc.constraint_schema
       AND ccu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, kcu.column_name
    `);

    expect(result.rows).toEqual([
      {
        table_name: 'expedientes',
        column_name: 'ubicacion_actual_id',
        foreign_table_name: 'ubicaciones',
        foreign_column_name: 'id',
      },
      {
        table_name: 'movimientos_expediente',
        column_name: 'expediente_id',
        foreign_table_name: 'expedientes',
        foreign_column_name: 'id',
      },
    ]);
  });
});
