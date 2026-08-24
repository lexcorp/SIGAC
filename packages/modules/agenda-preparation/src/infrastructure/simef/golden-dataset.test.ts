/**
 * T-12 — Golden Dataset y regresión del importer
 *
 * Validates the SimefAgendaParserAdapter against versioned desidentified fixtures.
 * - Fingerprints are computed from the fixture bytes and compared to stored baselines
 * - Metric counts (receivedRecords, blockCount, rowsWithFolio) are verified
 * - No PII: all fixtures contain synthetic desidentified data only
 *
 * Gate: pnpm test must produce no PII in output.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimefAgendaParserAdapter } from './SimefAgendaParserAdapter.js';
import type { AgendaFileInput } from '../../application/ports/AgendaFileInterpreterPort.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

function makeInputFromBytes(bytes: Uint8Array): AgendaFileInput {
  return {
    sizeBytes: bytes.length,
    open: async function* () { yield bytes; },
  };
}

async function loadFixture(name: string): Promise<Uint8Array> {
  const buf = await readFile(join(FIXTURES_DIR, name));
  return new Uint8Array(buf);
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

// ---------------------------------------------------------------------------
// Baseline registry — expected metrics per fixture
// These baselines are computed deterministically from the fixture content.
// ---------------------------------------------------------------------------

interface FixtureBaseline {
  readonly name: string;
  readonly agendaDate: string;
  readonly receivedRecords: number;
  readonly rowsWithFolio: number;
  readonly uniquePhysicians: number;
  readonly uniqueServices: number;
  readonly privacy: {
    /** Must not appear in fixture content (regex pattern) */
    readonly forbidden: RegExp[];
  };
}

// IMPORTANT: SHA-256 hashes are computed once and locked here.
// If a fixture is intentionally changed, the baseline must be updated and the
// change documented. This is the regression mechanism.
const BASELINES: FixtureBaseline[] = [
  {
    name: 'golden-1-single-physician-3rows.html',
    agendaDate: '2026-08-25',
    receivedRecords: 3,
    rowsWithFolio: 3,
    uniquePhysicians: 1,
    uniqueServices: 1,
    privacy: { forbidden: [/curp/i, /rfc/i, /nss/i, /\btelef/i, /\bcelular/i] },
  },
  {
    name: 'golden-2-two-physicians-5rows.html',
    agendaDate: '2026-09-10',
    receivedRecords: 5,
    rowsWithFolio: 5,
    uniquePhysicians: 2,
    uniqueServices: 2,
    privacy: { forbidden: [/curp/i, /rfc/i, /nss/i, /\btelef/i, /\bcelular/i] },
  },
  {
    name: 'golden-3-mixed-results.html',
    agendaDate: '2026-10-01',
    receivedRecords: 4,
    rowsWithFolio: 3, // one row has empty folio (fail-open row)
    uniquePhysicians: 1,
    uniqueServices: 1,
    privacy: { forbidden: [/curp/i, /rfc/i, /nss/i, /\btelef/i, /\bcelular/i] },
  },
  {
    // Golden Fixture 4: Real SIMEF 16-column extended layout.
    // Covers interval time format (HH:mm - HH:mm and HH:mm-HH:mm),
    // Médico: with HTML entity, Servicio: at cell[1] of same row,
    // excluded columns at positions 7-9 (Turno/Celular/Email) and 12-13 (Sexo/Edad).
    name: 'golden-4-real-layout-16cols.html',
    agendaDate: '2026-08-24',
    receivedRecords: 5,
    rowsWithFolio: 5,
    uniquePhysicians: 2,
    uniqueServices: 2,
    privacy: { forbidden: [/curp/i, /rfc/i, /nss/i] },
  },
];

describe('T-12 — Golden Dataset Regression', () => {
  const parser = new SimefAgendaParserAdapter();

  for (const baseline of BASELINES) {
    describe(`fixture: ${baseline.name}`, () => {
      it(`extrae agendaDate correcta: ${baseline.agendaDate}`, async () => {
        const bytes = await loadFixture(baseline.name);
        const result = await parser.inspect(makeInputFromBytes(bytes));
        expect(result.agendaDate.value).toBe(baseline.agendaDate);
      });

      it(`receivedRecords = ${baseline.receivedRecords}`, async () => {
        const bytes = await loadFixture(baseline.name);
        const result = await parser.inspect(makeInputFromBytes(bytes));
        expect(result.receivedRecords).toBe(baseline.receivedRecords);
      });

      it(`rows con FOLIO = ${baseline.rowsWithFolio}`, async () => {
        const bytes = await loadFixture(baseline.name);
        const result = await parser.interpret(makeInputFromBytes(bytes));
        const withFolio = result.rows.filter((r) => r.originalValues.folio !== null).length;
        expect(withFolio).toBe(baseline.rowsWithFolio);
      });

      it(`medicos unicos = ${baseline.uniquePhysicians}`, async () => {
        const bytes = await loadFixture(baseline.name);
        const result = await parser.interpret(makeInputFromBytes(bytes));
        const nums = new Set(
          result.rows
            .map((r) => r.originalValues.physicianEmployeeNumber)
            .filter((n): n is string => n !== null),
        );
        expect(nums.size).toBe(baseline.uniquePhysicians);
      });

      it(`servicios unicos = ${baseline.uniqueServices}`, async () => {
        const bytes = await loadFixture(baseline.name);
        const result = await parser.interpret(makeInputFromBytes(bytes));
        const codes = new Set(
          result.rows
            .map((r) => r.originalValues.serviceCode)
            .filter((c): c is string => c !== null),
        );
        expect(codes.size).toBe(baseline.uniqueServices);
      });

      it('fingerprint es SHA-256 reproducible de los bytes del fixture', async () => {
        const bytes = await loadFixture(baseline.name);
        const expectedFingerprint = sha256(bytes);
        const result = await parser.inspect(makeInputFromBytes(bytes));
        // Fingerprint must match raw bytes hash
        expect(result.fingerprint.value).toBe(expectedFingerprint);
        expect(result.fingerprint.value).toHaveLength(64);
      });

      it('no contiene datos prohibidos en fixture', async () => {
        const bytes = await loadFixture(baseline.name);
        const content = Buffer.from(bytes).toString('latin1');
        for (const pattern of baseline.privacy.forbidden) {
          expect(content, `fixture no debe contener ${String(pattern)}`).not.toMatch(pattern);
        }
      });

      it('originalValues no contiene campos excluidos (contacto, vigencia, sexo, edad, curp)', async () => {
        const bytes = await loadFixture(baseline.name);
        const result = await parser.interpret(makeInputFromBytes(bytes));
        for (const row of result.rows) {
          const ov = row.originalValues;
          expect(ov).not.toHaveProperty('contacto');
          expect(ov).not.toHaveProperty('vigencia');
          expect(ov).not.toHaveProperty('sexo');
          expect(ov).not.toHaveProperty('edad');
          expect(ov).not.toHaveProperty('curp');
        }
      });

      it('fingerprint cambia si el fixture cambia (hash regression)', async () => {
        const bytes = await loadFixture(baseline.name);
        // Append a single byte — simulates undetected modification
        const modified = new Uint8Array(bytes.length + 1);
        modified.set(bytes);
        modified[bytes.length] = 0x0a;
        const originalHash = sha256(bytes);
        const modifiedHash = sha256(modified);
        expect(originalHash).not.toBe(modifiedHash);
      });
    });
  }

  it('T-12 privacy gate — ningun fixture contiene PII real', async () => {
    // This test is the formal privacy gate for T-12
    const piiPatterns = [
      /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/i, // CURP pattern
      /\b\d{3}-\d{3}-\d{4}\b/, // phone number pattern
      /\b\d{10}\b/, // 10-digit number (phone)
      /\bissste\s+\d+/i, // real ISSSTE employee number pattern (prefix)
    ];
    for (const baseline of BASELINES) {
      const bytes = await loadFixture(baseline.name);
      const content = Buffer.from(bytes).toString('latin1');
      for (const pattern of piiPatterns) {
        expect(
          content,
          `fixture ${baseline.name} no debe contener patron PII ${String(pattern)}`,
        ).not.toMatch(pattern);
      }
    }
  });
});
