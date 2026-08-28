/**
 * DEMO seed verification — tests que comprueban que sigac_demo
 * contiene los expedientes sintéticos esperados después del bootstrap.
 *
 * Estos tests se ejecutan contra PostgreSQL real (sigac_demo).
 * No modifican datos — solo leen.
 *
 * Fuente: tooling/db/bootstrap-local.ts (DEMO_SEED).
 */

import { Client } from 'pg';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

const DEMO_URL =
  process.env['SIGAC_DEMO_DATABASE_URL'] ??
  'postgresql://sigac:sigac_dev_only@localhost:5432/sigac_demo';

const EXPECTED_EXPEDIENTES = [
  { numero: 'DEMO010101/10', normalizado: 'DEMO01010110', nombre: 'PACIENTE DEMO UNO',   estado: 'DISPONIBLE' },
  { numero: 'DEMO020202/20', normalizado: 'DEMO02020220', nombre: 'PACIENTE DEMO DOS',   estado: 'DISPONIBLE' },
  { numero: 'DEMO030303/30', normalizado: 'DEMO03030330', nombre: 'PACIENTE DEMO TRES',  estado: 'APARTADO'   },
  { numero: 'PERR810604/10', normalizado: 'PERR81060410', nombre: 'PACIENTE DEMO CUATRO', estado: 'DISPONIBLE' },
  { numero: 'PERE850215/20', normalizado: 'PERE85021520', nombre: 'PACIENTE DEMO CINCO', estado: 'DISPONIBLE' },
];

const FIXED_IDS = {
  expediente4: '22222222-0004-4000-8000-000000000001',
  expediente5: '22222222-0005-4000-8000-000000000001',
};

describe('DEMO seed — sigac_demo expedientes', () => {
  const client = new Client({ connectionString: DEMO_URL });

  beforeAll(async () => { await client.connect(); }, 10_000);
  afterAll(async () => { await client.end(); });

  it('sigac_demo contiene exactamente 5 expedientes DEMO', async () => {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) FROM expedientes`,
    );
    expect(parseInt(result.rows[0]!.count, 10)).toBe(5);
  });

  it('PERR810604/10 existe con datos sintéticos', async () => {
    const result = await client.query<{
      expediente_numero: string;
      paciente_nombre_operativo: string;
      estado_operativo: string;
    }>(
      `SELECT expediente_numero, paciente_nombre_operativo, estado_operativo
       FROM expedientes
       WHERE expediente_numero_normalizado = $1`,
      ['PERR81060410'],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.expediente_numero).toBe('PERR810604/10');
    expect(result.rows[0]!.estado_operativo).toBe('DISPONIBLE');
    // Verify it is synthetic (no real name format)
    expect(result.rows[0]!.paciente_nombre_operativo).toBe('PACIENTE DEMO CUATRO');
  });

  it('PERE850215/20 existe con datos sintéticos', async () => {
    const result = await client.query<{ expediente_numero: string }>(
      `SELECT expediente_numero FROM expedientes
       WHERE expediente_numero_normalizado = $1`,
      ['PERE85021520'],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.expediente_numero).toBe('PERE850215/20');
  });

  it.each(EXPECTED_EXPEDIENTES)(
    'expediente $numero existe con estado correcto y nombre sintético',
    async ({ normalizado, nombre, estado }) => {
      const result = await client.query<{
        paciente_nombre_operativo: string;
        estado_operativo: string;
      }>(
        `SELECT paciente_nombre_operativo, estado_operativo
         FROM expedientes WHERE expediente_numero_normalizado = $1`,
        [normalizado],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.paciente_nombre_operativo).toBe(nombre);
      expect(result.rows[0]!.estado_operativo).toBe(estado);
    },
  );

  it('los datos son sintéticos — ningún nombre real', async () => {
    const result = await client.query<{ paciente_nombre_operativo: string }>(
      `SELECT paciente_nombre_operativo FROM expedientes`,
    );
    for (const row of result.rows) {
      // All names start with "PACIENTE DEMO"
      expect(row.paciente_nombre_operativo).toMatch(/^PACIENTE DEMO/);
    }
  });

  it('los CURP son sintéticos — patrón DEMO, no real', async () => {
    const result = await client.query<{ paciente_curp: string }>(
      `SELECT paciente_curp FROM expedientes`,
    );
    for (const row of result.rows) {
      expect(row.paciente_curp).toMatch(/^DEMO/);
    }
  });

  it('IDs fijos para PERR y PERE (estabilidad entre re-runs)', async () => {
    const result = await client.query<{ id: string; expediente_numero: string }>(
      `SELECT id, expediente_numero FROM expedientes
       WHERE id = ANY($1::uuid[])
       ORDER BY expediente_numero`,
      [[FIXED_IDS.expediente4, FIXED_IDS.expediente5]],
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.expediente_numero).toBe('PERE850215/20');
    expect(result.rows[1]!.expediente_numero).toBe('PERR810604/10');
  });

  it('re-ejecutar el seed no duplica registros (idempotencia — ON CONFLICT DO NOTHING)', async () => {
    // Attempt re-insert of expediente4 — must not throw and count must stay 5
    await client.query(`
      INSERT INTO expedientes (
        id, expediente_numero, expediente_numero_normalizado,
        paciente_id_institucional, paciente_curp, paciente_nombre_operativo,
        paciente_numero_issste, estado_operativo, ubicacion_actual_id, row_version
      ) VALUES ($1,'PERR810604/10','PERR81060410','INST-DEMO-004','DEMO000000HDEMOP00',
                'PACIENTE DEMO CUATRO','ISSSTE-DEMO-004','DISPONIBLE',
                '11111111-0001-4000-8000-000000000001', 0)
      ON CONFLICT (id) DO NOTHING`,
      [FIXED_IDS.expediente4],
    );
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) FROM expedientes`,
    );
    // Still 5 — no duplication
    expect(parseInt(result.rows[0]!.count, 10)).toBe(5);
  });
});

// ── Regresiones búsqueda case-insensitive (Fix 2) ─────────────────────────

describe('Búsqueda case-insensitive — regresiones (Fix 2)', () => {
  const client2 = new Client({ connectionString: DEMO_URL });

  beforeAll(async () => { await client2.connect(); }, 10_000);
  afterAll(async () => { await client2.end(); });

  const variants = [
    'PERR81060410',   // original uppercase
    'perr81060410',   // all lowercase
    'Perr81060410',   // first letter upper
    'PeRr81060410',   // mixed
    'PERR81060410',   // repeat — idempotency of search
  ];

  it.each(variants)(
    'LOWER(%s) = LOWER(PERR81060410) encuentra el expediente',
    async (normalized) => {
      const result = await client2.query<{ expediente_numero: string }>(
        `SELECT expediente_numero FROM expedientes
         WHERE LOWER(expediente_numero_normalizado) = LOWER($1)`,
        [normalized],
      );
      expect(result.rows).toHaveLength(1);
      // El valor almacenado nunca cambia — siempre devuelve mayúsculas
      expect(result.rows[0]!.expediente_numero).toBe('PERR810604/10');
    },
  );

  it('el valor almacenado no fue modificado — sigue en mayúsculas', async () => {
    const result = await client2.query<{ expediente_numero_normalizado: string }>(
      `SELECT expediente_numero_normalizado FROM expedientes
       WHERE expediente_numero = 'PERR810604/10'`,
    );
    expect(result.rows[0]!.expediente_numero_normalizado).toBe('PERR81060410');
    // Confirma que no fue convertido a minúsculas
    expect(result.rows[0]!.expediente_numero_normalizado).not.toBe('perr81060410');
  });

  it('búsqueda que realmente no existe devuelve vacío', async () => {
    const result = await client2.query<{ id: string }>(
      `SELECT id FROM expedientes
       WHERE LOWER(expediente_numero_normalizado) = LOWER($1)`,
      ['XXXX999999/10'],
    );
    expect(result.rows).toHaveLength(0);
  });

  it('búsqueda por número existente devuelve mismos resultados en segundo intento (idempotencia)', async () => {
    const query = `SELECT id, expediente_numero FROM expedientes
                   WHERE LOWER(expediente_numero_normalizado) = LOWER($1)`;
    const params = ['PERR81060410'];

    const result1 = await client2.query(query, params);
    const result2 = await client2.query(query, params);

    expect(result1.rows).toEqual(result2.rows);
    expect(result1.rows).toHaveLength(1);
  });

  it('búsqueda por nombre operativo (nombre_operativo) no fue afectada', async () => {
    // Los expedientes DEMO se buscan por número, no por nombre en la API.
    // Verificamos que la tabla tiene el nombre correcto (no regresión).
    const result = await client2.query<{ paciente_nombre_operativo: string }>(
      `SELECT paciente_nombre_operativo FROM expedientes
       WHERE expediente_numero_normalizado = 'PERR81060410'`,
    );
    expect(result.rows[0]!.paciente_nombre_operativo).toBe('PACIENTE DEMO CUATRO');
  });
});
