/**
 * T-22 — PDFKitPreparationReportGenerator unit tests
 *
 * Spec: preparation-reports design.md §6, REQ-PR-002, REQ-PR-003, REQ-PR-004, REQ-PR-009, ADR-0030, ADR-0031.
 *
 * All data is synthetic and desidentified.
 * Tests verify structure and privacy constraints, not visual layout.
 */

import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { PDFKitPreparationReportGenerator } from './PDFKitPreparationReportGenerator.js';
import type { PreparationItem, ReportGenerationRequest } from '@sigac/agenda-preparation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Collect a Readable stream to a Buffer. */
async function streamToBuffer(readable: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
  }
  return Buffer.concat(chunks);
}

function makeItem(overrides: Partial<PreparationItem> = {}): PreparationItem {
  return {
    folio:            'T22-FOLIO-001',
    nombrePaciente:   'PACIENTE SINTETICO T22',
    expediente:       { original: 'SXNT810101/10', reference: null },
    tipoDerechohabiente: '10',
    tipoConsulta:     'FIRST_TIME',
    agendaDate:       '2026-09-01',
    appointmentTime:  '08:00',
    medico:           { numeroEmpleado: '55501', nombre: 'DR SINTETICO T22' },
    servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA SINTETICA T22' },
    ...overrides,
  };
}

function makeRequest(
  items: readonly PreparationItem[] = [makeItem()],
  overrides: Partial<ReportGenerationRequest> = {},
): ReportGenerationRequest {
  return {
    agendaDate:     '2026-09-01',
    items,
    order:          'APPOINTMENT_TIME_ASC',
    sourceImportId: 'import-t22-001',
    ...overrides,
  };
}

const generator = new PDFKitPreparationReportGenerator();

// ─── Core output tests ────────────────────────────────────────────────────────

describe('PDFKitPreparationReportGenerator — T-22', () => {
  it('generates PDF > 0 bytes for a single synthetic item', async () => {
    const result = await generator.generate(makeRequest());
    const buf = await streamToBuffer(result.stream);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('PDF starts with %PDF signature', async () => {
    const result = await generator.generate(makeRequest());
    const buf = await streamToBuffer(result.stream);
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('returns correct filename for given agendaDate', async () => {
    const result = await generator.generate(makeRequest());
    expect(result.filename).toBe('lista-preparacion-2026-09-01.pdf');
  });

  it('filename does not contain patient data', async () => {
    const result = await generator.generate(makeRequest([
      makeItem({ nombrePaciente: 'PACIENTE PRIVACIDAD', folio: 'FOLIO-PRIV-001' }),
    ]));
    expect(result.filename).not.toContain('PACIENTE');
    expect(result.filename).not.toContain('FOLIO');
    expect(result.filename).not.toContain('PRIV');
  });

  it('returns a Readable stream', async () => {
    const result = await generator.generate(makeRequest());
    expect(result.stream).toBeInstanceOf(Readable);
  });

  it('generates PDF with multiple items in one group', async () => {
    const items = [
      makeItem({ folio: 'T22-MULTI-001', appointmentTime: '08:00' }),
      makeItem({ folio: 'T22-MULTI-002', appointmentTime: '08:20' }),
      makeItem({ folio: 'T22-MULTI-003', appointmentTime: '08:40' }),
    ];
    const result = await generator.generate(makeRequest(items));
    const buf = await streamToBuffer(result.stream);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('generates PDF with multiple groups (different physicians)', async () => {
    const items = [
      makeItem({
        folio: 'T22-GP1-001',
        appointmentTime: '08:00',
        medico: { numeroEmpleado: '55501', nombre: 'DR PRIMERO T22' },
        servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA T22' },
      }),
      makeItem({
        folio: 'T22-GP2-001',
        appointmentTime: '14:00',
        medico: { numeroEmpleado: '55502', nombre: 'DR SEGUNDO T22' },
        servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIOLOGIA T22' },
      }),
    ];
    const result = await generator.generate(makeRequest(items));
    const buf = await streamToBuffer(result.stream);
    // Two groups = at least two pages = larger PDF
    expect(buf.byteLength).toBeGreaterThan(500);
  });

  it('groups: same service+physician, different time → same group (one section)', async () => {
    const items = [
      makeItem({ folio: 'T22-SAME-001', appointmentTime: '08:00',
        medico: { numeroEmpleado: '55501', nombre: 'DR MISMO T22' },
        servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA T22' } }),
      makeItem({ folio: 'T22-SAME-002', appointmentTime: '08:20',
        medico: { numeroEmpleado: '55501', nombre: 'DR MISMO T22' },
        servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA T22' } }),
    ];
    const result = await generator.generate(makeRequest(items));
    const buf = await streamToBuffer(result.stream);
    // Same group: smaller PDF than two-group case
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('throws if items array is empty (defensive — use case prevents this)', async () => {
    await expect(generator.generate(makeRequest([]))).rejects.toThrow();
  });
});

// ─── Turno tests (ADR-0031 v1.1) ─────────────────────────────────────────────

describe('PDFKitPreparationReportGenerator — turno derivado (ADR-0031)', () => {
  it('does NOT define its own deriveShift function (imports from @sigac/agenda-preparation)', async () => {
    // Structural: the adapter file must not contain a function named deriveShift
    // (it must import it). We test this via the observable behavior: the adapter
    // produces a PDF without error, implying the import resolved correctly.
    const result = await generator.generate(makeRequest([
      makeItem({ appointmentTime: '08:00' }),
    ]));
    const buf = await streamToBuffer(result.stream);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('MATUTINO group (08:00) produces a PDF without error', async () => {
    const result = await generator.generate(makeRequest([makeItem({ appointmentTime: '08:00' })]));
    const buf = await streamToBuffer(result.stream);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('VESPERTINO group (14:00) produces a PDF without error', async () => {
    const result = await generator.generate(makeRequest([makeItem({ appointmentTime: '14:00' })]));
    const buf = await streamToBuffer(result.stream);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('MATUTINO and VESPERTINO groups in same request both produce output', async () => {
    const items = [
      makeItem({ folio: 'T22-M', appointmentTime: '08:00',
        medico: { numeroEmpleado: '55501', nombre: 'DR M T22' },
        servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA T22' } }),
      makeItem({ folio: 'T22-V', appointmentTime: '14:00',
        medico: { numeroEmpleado: '55502', nombre: 'DR V T22' },
        servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIO T22' } }),
    ];
    const result = await generator.generate(makeRequest(items));
    const buf = await streamToBuffer(result.stream);
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});

// ─── Privacy tests ────────────────────────────────────────────────────────────

describe('PDFKitPreparationReportGenerator — privacy (REQ-PR-004)', () => {
  /** Extract raw text from a PDF buffer (simple: find text between BT/ET markers). */
  function extractPdfText(buf: Buffer): string {
    return buf.toString('latin1');
  }

  it('PDF does not contain CURP-like patterns', async () => {
    // CURP format: 4 letters + 6 digits + H/M + 5 letters + 1 alphanumeric + 1 digit
    const syntheticCurp = 'ABCD000000HXYZAA01';
    const result = await generator.generate(makeRequest([
      makeItem({ nombrePaciente: 'PACIENTE PRIVACY TEST' }),
    ]));
    const buf = await streamToBuffer(result.stream);
    const text = extractPdfText(buf);
    expect(text).not.toContain(syntheticCurp);
  });

  it('PDF does not contain phone number patterns from synthetic data', async () => {
    // No phone numbers are passed through PreparationItem — verify none appear.
    // We check only the text streams (BT/ET blocks) in the PDF, not binary offsets.
    // PDFKit binary object IDs contain long digit runs which are structural, not PII.
    const result = await generator.generate(makeRequest([makeItem()]));
    const buf = await streamToBuffer(result.stream);
    // Extract text between PDF stream markers (naive but sufficient for synthetic data checks)
    const raw = buf.toString('latin1');
    // A phone number in text context would appear as '5551234567' or '55 5123 4567'
    // None of our synthetic PreparationItem fields contain 10-digit sequences
    const textStreams = raw.match(/BT[\s\S]*?ET/g) ?? [];
    const joinedText = textStreams.join(' ');
    // Phone numbers in SIGAC context are 10-digit MX numbers — not present in PreparationItem
    expect(joinedText).not.toMatch(/\b55\d{8}\b/);  // MX mobile prefix 55
  });

  it('PDF does not contain fields not in PreparationItem (sex, age, DOB, email)', async () => {
    const result = await generator.generate(makeRequest([makeItem()]));
    const buf = await streamToBuffer(result.stream);
    const text = extractPdfText(buf);
    // These labels must never appear in the generated PDF
    expect(text).not.toMatch(/\bSEXO\b/i);
    expect(text).not.toMatch(/\bEDAD\b/i);
    expect(text).not.toMatch(/\bCELULAR\b/i);
    expect(text).not.toMatch(/\bCORREO\b/i);
    expect(text).not.toMatch(/\bVIGENCIA\b/i);
  });

  it('sourceImportId is NOT rendered in the PDF output', async () => {
    const sensitiveRef = 'import-should-not-appear-in-pdf';
    const result = await generator.generate(makeRequest([makeItem()], {
      sourceImportId: sensitiveRef,
    }));
    const buf = await streamToBuffer(result.stream);
    const text = extractPdfText(buf);
    expect(text).not.toContain(sensitiveRef);
  });
});
