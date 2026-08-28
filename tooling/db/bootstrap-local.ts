/**
 * bootstrap-local.ts
 *
 * Initialises the local DEMO database (sigac_demo) for development.
 *
 * - Connects to sigac_demo (hard-coded, never from CLI/user input — security rule).
 * - Applies all tenant migrations found in migrations/tenant/ in alphabetical order.
 * - Idempotent: uses IF NOT EXISTS / ON CONFLICT for every step.
 * - Records applied migrations in a local tracking table so re-runs are safe.
 *
 * Run via:
 *   pnpm db:bootstrap
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

// ──────────────────────────────────────────────────────────────────────────────
// Connection — hard-coded DEMO database; NEVER accept arbitrary names from args.
// ──────────────────────────────────────────────────────────────────────────────

const DEMO_URL =
  process.env['SIGAC_DEMO_DATABASE_URL'] ??
  'postgresql://sigac:sigac_dev_only@localhost:5432/sigac_demo';

// Resolve migrations directory relative to this file (works as ESM)
const MIGRATIONS_DIR = new URL('../../migrations/tenant/', import.meta.url);

async function main(): Promise<void> {
  const client = new Client({ connectionString: DEMO_URL });
  await client.connect();
  console.log('[bootstrap] Connected to sigac_demo.');

  try {
    // ── 1. Ensure migration tracking table exists ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS _local_migrations (
        filename  text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // ── 2. Discover and sort migration files ──────────────────────────────
    const dir = fileURLToPath(MIGRATIONS_DIR);
    const files = (await readdir(dir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('[bootstrap] No migration files found. Nothing to apply.');
      return;
    }

    // ── 3. Apply each migration if not already recorded ───────────────────
    for (const file of files) {
      const { rows } = await client.query<{ filename: string }>(
        'SELECT filename FROM _local_migrations WHERE filename = $1',
        [file],
      );
      if (rows.length > 0) {
        console.log(`[bootstrap] Skipping ${file} (already applied).`);
        continue;
      }

      const sql = await readFile(new URL(file, MIGRATIONS_DIR), 'utf8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      console.log(`[bootstrap] Applying ${file} (${statements.length} statement(s))…`);

      // Run inside a transaction so savepoints work.
      // Each statement gets its own savepoint so "already exists" errors
      // from a partial previous run are skipped gracefully.
      await client.query('BEGIN');
      try {
        for (const statement of statements) {
          await client.query('SAVEPOINT bootstrap_stmt');
          try {
            await client.query(statement);
            await client.query('RELEASE SAVEPOINT bootstrap_stmt');
          } catch (err: unknown) {
            await client.query('ROLLBACK TO SAVEPOINT bootstrap_stmt');
            await client.query('RELEASE SAVEPOINT bootstrap_stmt');
            const msg = err instanceof Error ? err.message : String(err);
            // "already exists" is expected for idempotent re-runs
            if (/already exists/i.test(msg)) {
              console.log(`[bootstrap]   (skipped: ${msg.split('\n')[0]})`);
            } else {
              await client.query('ROLLBACK');
              throw err;
            }
          }
        }
        await client.query('COMMIT');
      } catch (err: unknown) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      }

      await client.query(
        'INSERT INTO _local_migrations (filename) VALUES ($1)',
        [file],
      );
      console.log(`[bootstrap] Applied ${file}.`);
    }

    // ── 4. Seed DEMO data (idempotent) ───────────────────────────────────────
    await seedDemoData(client);

    console.log('[bootstrap] sigac_demo is ready for development.');
  } finally {
    await client.end();
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// DEMO seed data — completely synthetic, no PII
// Idempotent: uses ON CONFLICT DO NOTHING for every INSERT.
// These records allow manual testing of ExpedienteWorkspace in the DEMO tenant.
// ─────────────────────────────────────────────────────────────────────────────

// Fixed UUIDs for referential integrity across re-runs
const DEMO_SEED = {
  locationArchive:  '11111111-0001-4000-8000-000000000001',
  locationConsult1: '11111111-0002-4000-8000-000000000001',
  locationConsult2: '11111111-0003-4000-8000-000000000001',
  expediente1: '22222222-0001-4000-8000-000000000001',
  expediente2: '22222222-0002-4000-8000-000000000001',
  expediente3: '22222222-0003-4000-8000-000000000001',
  // T-38 DEMO additions: allow testing PERR/PERE format in ExpedienteWorkspace
  expediente4: '22222222-0004-4000-8000-000000000001',
  expediente5: '22222222-0005-4000-8000-000000000001',
} as const;

async function seedDemoData(client: import('pg').Client): Promise<void> {
  // Ubicaciones
  await client.query(`
    INSERT INTO ubicaciones (id, codigo, descripcion) VALUES
      ($1, 'ARCHIVO',  'Archivo Central'),
      ($2, 'CONS-001', 'Consultorio 001 - Medicina General'),
      ($3, 'CONS-002', 'Consultorio 002 - Cardiología')
    ON CONFLICT (id) DO NOTHING`,
    [DEMO_SEED.locationArchive, DEMO_SEED.locationConsult1, DEMO_SEED.locationConsult2],
  );

  // Expedientes DEMO (datos sintéticos desidentificados — formato RFC+COD)
  // Estado: DISPONIBLE para permitir flujo completo en DEMO
  const expedientes = [
    {
      id:            DEMO_SEED.expediente1,
      numero:        'DEMO010101/10',
      normalizado:   'DEMO01010110',
      idInst:        'INST-DEMO-001',
      curp:          'DEMO000000HDEMOA00',
      nombre:        'PACIENTE DEMO UNO',
      issste:        'ISSSTE-DEMO-001',
      estado:        'DISPONIBLE',
      ubicacion:     DEMO_SEED.locationArchive,
    },
    {
      id:            DEMO_SEED.expediente2,
      numero:        'DEMO020202/20',
      normalizado:   'DEMO02020220',
      idInst:        'INST-DEMO-002',
      curp:          'DEMO000000MDEMOB00',
      nombre:        'PACIENTE DEMO DOS',
      issste:        'ISSSTE-DEMO-002',
      estado:        'DISPONIBLE',
      ubicacion:     DEMO_SEED.locationArchive,
    },
    {
      id:            DEMO_SEED.expediente3,
      numero:        'DEMO030303/30',
      normalizado:   'DEMO03030330',
      idInst:        'INST-DEMO-003',
      curp:          'DEMO000000HDEMOC00',
      nombre:        'PACIENTE DEMO TRES',
      issste:        'ISSSTE-DEMO-003',
      estado:        'APARTADO',
      ubicacion:     DEMO_SEED.locationArchive,
    },
    // T-38: PERR/PERE format expedientes for ExpedienteWorkspace manual testing
    {
      id:            DEMO_SEED.expediente4,
      numero:        'PERR810604/10',
      normalizado:   'PERR81060410',
      idInst:        'INST-DEMO-004',
      curp:          'DEMO000000HDEMOP00',
      nombre:        'PACIENTE DEMO CUATRO',
      issste:        'ISSSTE-DEMO-004',
      estado:        'DISPONIBLE',
      ubicacion:     DEMO_SEED.locationArchive,
    },
    {
      id:            DEMO_SEED.expediente5,
      numero:        'PERE850215/20',
      normalizado:   'PERE85021520',
      idInst:        'INST-DEMO-005',
      curp:          'DEMO000000MDEMOD00',
      nombre:        'PACIENTE DEMO CINCO',
      issste:        'ISSSTE-DEMO-005',
      estado:        'DISPONIBLE',
      ubicacion:     DEMO_SEED.locationArchive,
    },
  ];

  for (const e of expedientes) {
    await client.query(`
      INSERT INTO expedientes (
        id, expediente_numero, expediente_numero_normalizado,
        paciente_id_institucional, paciente_curp, paciente_nombre_operativo,
        paciente_numero_issste, estado_operativo, ubicacion_actual_id,
        row_version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0)
      ON CONFLICT (id) DO NOTHING`,
      [e.id, e.numero, e.normalizado, e.idInst, e.curp, e.nombre,
       e.issste, e.estado, e.ubicacion],
    );
  }
  console.log('[bootstrap] DEMO seed data applied (ubicaciones + expedientes).');
}

main().catch((error) => {
  console.error('[bootstrap] FAILED:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
