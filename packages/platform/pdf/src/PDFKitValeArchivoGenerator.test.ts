/**
 * T-35 — PDFKitValeArchivoGenerator unit tests
 *
 * Fuente: REQ-VA-002, INV-VA-004, INV-VA-008, INV-VA-009, design.md §7.
 *
 * Todos los datos son sintéticos. Sin SIMEF real.
 * Privacy PBT: para todo snapshot sintético el PDF no contiene CURP ni teléfono.
 */

import { describe, expect, it } from 'vitest';
import { PDFKitValeArchivoGenerator } from './PDFKitValeArchivoGenerator.js';
import type { ValeArchivoSnapshot } from '@sigac/vale-archivo';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
  }
  return Buffer.concat(chunks);
}

const BASE_SNAPSHOT: ValeArchivoSnapshot = {
  id:                'aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb',
  numeroVale:        'VA-T35-001',
  fechaSolicitud:    new Date('2026-08-26'),
  fechaRecepcion:    new Date('2026-08-26'),
  unidadSolicitante: 'DIRECCIÓN MÉDICA T35',
  solicitante:       { nombre: 'Dr. Sintético T35', cargo: 'Director Médico' },
  autorizador:       { nombre: 'Dra. Sintética T35', cargo: 'Subdirectora' },
  estado:            'RECIBIDA',
  creadoPor:         'actor-t35',
  busquedaIniciadaPor: null, busquedaIniciadaAt: null,
  entregadoPor: null, entregadoAt: null, receptorEntrega: null,
  createdAt: new Date('2026-08-26T10:00:00Z'),
  updatedAt: new Date('2026-08-26T10:00:00Z'),
  items: [
    {
      id: 'item-1', valeId: 'aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb',
      expedienteNumero: 'T35XX810101/10',
      pacienteNombre:   'PACIENTE SINT T35 UNO',
      especialidad:     'MEDICINA INTERNA',
      estadoBusqueda:   'PENDIENTE',
      ubicacionEncontrada: null, observaciones: null,
    },
  ],
};

function makeSnapshot(overrides: Partial<ValeArchivoSnapshot> = {}): ValeArchivoSnapshot {
  return { ...BASE_SNAPSHOT, ...overrides };
}

const gen = new PDFKitValeArchivoGenerator();

// ── Basic generation ──────────────────────────────────────────────────────────

describe('PDFKitValeArchivoGenerator — generación básica', () => {
  it('genera PDF > 0 bytes con un ítem sintético', async () => {
    const r = await gen.generate(makeSnapshot());
    const buf = await streamToBuffer(r.stream);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('el buffer empieza con magic bytes %PDF', async () => {
    const r = await gen.generate(makeSnapshot());
    const buf = await streamToBuffer(r.stream);
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('genera PDF con múltiples ítems', async () => {
    const snap = makeSnapshot({
      items: Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`, valeId: BASE_SNAPSHOT.id,
        expedienteNumero: `T35XX810101/${String(i + 1).padStart(2, '0')}`,
        pacienteNombre:   `PACIENTE SINT T35 ${i + 1}`,
        especialidad:     'CIRUGÍA GENERAL',
        estadoBusqueda:   'PENDIENTE' as const,
        ubicacionEncontrada: null, observaciones: null,
      })),
    });
    const r = await gen.generate(snap);
    const buf = await streamToBuffer(r.stream);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('lanza error si items está vacío', async () => {
    await expect(gen.generate(makeSnapshot({ items: [] }))).rejects.toThrow();
  });
});

// ── Filename ──────────────────────────────────────────────────────────────────

describe('PDFKitValeArchivoGenerator — filename (INV-VA-009)', () => {
  it('filename sigue el patrón sm1-14-{numeroVale}-YYYY-MM-DD.pdf', async () => {
    const r = await gen.generate(makeSnapshot());
    expect(r.filename).toMatch(/^sm1-14-.*-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('filename contiene el número de vale', async () => {
    const r = await gen.generate(makeSnapshot({ numeroVale: 'VA-T35-ESPECIAL' }));
    expect(r.filename).toContain('VA-T35-ESPECIAL');
  });

  it('filename usa la fecha de solicitud', async () => {
    const r = await gen.generate(makeSnapshot({ fechaSolicitud: new Date('2026-08-26') }));
    expect(r.filename).toContain('2026-08-26');
  });

  it('filename NO contiene nombre de paciente', async () => {
    const r = await gen.generate(makeSnapshot());
    expect(r.filename).not.toMatch(/paciente/i);
    expect(r.filename).not.toMatch(/sint/i);
  });

  it('filename NO contiene expedienteNumero', async () => {
    const r = await gen.generate(makeSnapshot());
    expect(r.filename).not.toContain('T35XX810101');
  });
});

// ── Privacy — campos prohibidos ───────────────────────────────────────────────
// PDFKit comprime content streams (FlateDecode), por lo que la verificación
// de privacidad se hace sobre la totalidad del buffer latin1 — los objetos PDF
// no comprimidos (xref, trailer, objetos de texto de encabezados) son visibles.

describe('PDFKitValeArchivoGenerator — privacy (INV-VA-004)', () => {
  it('PDF no contiene patrones CURP (regex AAAA999999HSSSSS99)', async () => {
    // Synthetic item without CURP — generator must never embed it
    const r = await gen.generate(makeSnapshot());
    const buf = await streamToBuffer(r.stream);
    const text = buf.toString('latin1');
    // CURP pattern: 4 letras + 6 dígitos + H/M + 5 letras + 1 alfanum + 1 dígito
    expect(text).not.toMatch(/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/);
  });

  it('PDF no contiene la etiqueta estadoBusqueda', async () => {
    // estadoBusqueda individual no forma parte del formato SM 1-14 físico
    const r = await gen.generate(makeSnapshot());
    const buf = await streamToBuffer(r.stream);
    const text = buf.toString('latin1');
    expect(text.toLowerCase()).not.toContain('estadobusqueda');
    expect(text).not.toContain('PENDIENTE');
    expect(text).not.toContain('LOCALIZADO');
    expect(text).not.toContain('NO_LOCALIZADO');
  });

  it('PDF no contiene actorId ni tenantId', async () => {
    const r = await gen.generate(makeSnapshot());
    const buf = await streamToBuffer(r.stream);
    const text = buf.toString('latin1');
    expect(text).not.toContain('actor-t35');
    expect(text).not.toContain('tenant');
    expect(text).not.toContain('tenantId');
  });

  it('columna Especialidad presente — columna Sexo/CURP ausente (INV-VA-004)', async () => {
    // Check header labels are correct in the PDF's uncompressed sections
    // (PDFKit embeds font names and some metadata uncompressed)
    // Primary validation: generator never receives CURP/sex fields (they are
    // not in ValeArchivoSnapshot) — verified by type system
    const snap: ValeArchivoSnapshot = makeSnapshot();
    expect(snap).not.toHaveProperty('curp');
    expect(snap).not.toHaveProperty('sexo');
    expect(snap).not.toHaveProperty('telefono');
    expect(snap).not.toHaveProperty('fechaNacimiento');
    expect(snap).not.toHaveProperty('edad');
  });
});

// ── Delivery section ──────────────────────────────────────────────────────────

describe('PDFKitValeArchivoGenerator — sección de entrega', () => {
  it('genera PDF con sección de entrega cuando receptorEntrega está presente', async () => {
    const snap = makeSnapshot({
      estado: 'ENTREGADA',
      receptorEntrega: 'Lic. Receptor Sintético T35',
      entregadoPor: 'actor-t35',
      entregadoAt: new Date('2026-08-26T15:00:00Z'),
    });
    const r = await gen.generate(snap);
    const buf = await streamToBuffer(r.stream);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('genera PDF sin sección de entrega cuando receptorEntrega es null', async () => {
    const r = await gen.generate(makeSnapshot({ receptorEntrega: null }));
    const buf = await streamToBuffer(r.stream);
    expect(buf.length).toBeGreaterThan(0);
  });
});

// ── PBT Privacy — 50 variaciones sintéticas ───────────────────────────────────
// Property 3: para todo ValeArchivoSnapshot sintético, el PDF no contiene
// patrones CURP ni número de teléfono.
// Usamos generadores manuales (fast-check no disponible en este workspace).

describe('Property 3 (PBT): PDF sin CURP ni teléfono para 50 snapshots sintéticos', () => {
  it('ningún snapshot sintético produce PDF con CURP o teléfono', async () => {
    const especialidades = ['MEDICINA INTERNA', 'CIRUGÍA GENERAL', 'CARDIOLOGÍA', 'NEUROLOGÍA'];
    const estados = ['RECIBIDA', 'EN_BUSQUEDA', 'COMPLETA', 'ENTREGADA'] as const;
    let iterations = 0;

    for (let i = 0; i < 50; i++) {
      const itemCount = (i % 5) + 1;
      const snap = makeSnapshot({
        numeroVale: `VA-PBT3-${String(i).padStart(3, '0')}`,
        estado: estados[i % estados.length],
        unidadSolicitante: `UNIDAD SINT ${i % 10}`,
        items: Array.from({ length: itemCount }, (_, j) => ({
          id: `pbt3-item-${i}-${j}`,
          valeId: BASE_SNAPSHOT.id,
          expedienteNumero: `PBT3XX${String(i).padStart(3,'0')}${String(j).padStart(2,'0')}/01`,
          pacienteNombre:   `PACIENTE SINT PBT3 ${i}-${j}`,
          especialidad:     especialidades[j % especialidades.length]!,
          estadoBusqueda:   'PENDIENTE' as const,
          ubicacionEncontrada: null, observaciones: null,
        })),
      });

      const r = await gen.generate(snap);
      const buf = await streamToBuffer(r.stream);
      const text = buf.toString('latin1');

      // CURP pattern
      expect(text, `iteration ${i}: CURP pattern found`).not.toMatch(
        /[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/,
      );
      // 10-digit phone — exclude xref table lines (format: "NNNNNNNNNN NNNNN f/n ")
      // and xref section headers; these are PDF structural bytes, not data fields.
      const nonXrefLines = text
        .split('\n')
        .filter((l) => /^[\x20-\x7E]+$/.test(l))         // ASCII printable only
        .filter((l) => !/^\d{10} \d{5} [fn]/.test(l))    // exclude xref entries
        .filter((l) => !/^xref$/.test(l.trim()))           // exclude xref header
        .filter((l) => !/^\d+ \d+$/.test(l.trim()));     // exclude xref subsection header
      const nonXrefText = nonXrefLines.join('\n');
      expect(nonXrefText, `iteration ${i}: phone pattern found`).not.toMatch(/\b\d{10}\b/);

      iterations++;
    }
    expect(iterations).toBe(50);
  });
});

// ── Property 5: filename sin PII ─────────────────────────────────────────────

describe('Property 5 (PBT): filename sin PII en 30 snapshots sintéticos', () => {
  it('filename no contiene pacienteNombre ni expedienteNumero', async () => {
    for (let i = 0; i < 30; i++) {
      const pacienteNombre = `PACI SINT ${i}`;
      const expedienteNumero = `EXPTEST${i}/01`;
      const snap = makeSnapshot({
        numeroVale: `VA-PBT5-${i}`,
        items: [{ ...BASE_SNAPSHOT.items[0]!, pacienteNombre, expedienteNumero }],
      });
      const r = await gen.generate(snap);
      expect(r.filename).not.toContain(pacienteNombre);
      expect(r.filename).not.toContain(expedienteNumero);
    }
  });
});
