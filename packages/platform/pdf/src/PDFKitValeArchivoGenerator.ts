/**
 * PDFKitValeArchivoGenerator
 *
 * Infrastructure adapter: genera la representación digital del formato SM 1-14
 * a partir de ValeArchivoSnapshot. Implementa ValeArchivoReportGeneratorPort.
 *
 * Fuente: design.md §7, REQ-VA-002, INV-VA-004, INV-VA-008, INV-VA-009.
 * ADR-0030: PDFKit — generación backend en memoria.
 * ADR-0032: Vale Archivo bounded context independiente.
 *
 * Restricciones:
 *   - Stream en memoria; nunca escribe en filesystem.
 *   - Campos permitidos: número de vale, fechas, unidad, solicitante,
 *     autorizador, tabla de ítems (expediente, nombre, especialidad).
 *   - Campos PROHIBIDOS: CURP, teléfono, fecha de nacimiento, correo, edad, sexo,
 *     estadoBusqueda individual de cada ítem (no forma parte del SM 1-14 físico).
 *   - No importa @sigac/agenda-preparation (ADR-0032).
 *   - filename: sm1-14-{numeroVale}-{YYYY-MM-DD}.pdf donde la fecha es fechaSolicitud.
 */

import { Readable } from 'node:stream';
import PDFDocument from 'pdfkit';
import type {
  ValeArchivoReportGeneratorPort,
  ValeArchivoReportResult,
  ValeArchivoSnapshot,
} from '@sigac/vale-archivo';

// ── Layout ────────────────────────────────────────────────────────────────────

const PAGE = {
  size:    'LETTER' as const,
  margins: { top: 45, bottom: 50, left: 45, right: 45 },
} as const;

const FONT = { regular: 'Helvetica', bold: 'Helvetica-Bold' } as const;

const COLOR = {
  black:      '#000000',
  headerBg:   '#1a1a2e',
  headerText: '#ffffff',
  rowAlt:     '#f5f5f5',
  rule:       '#cccccc',
  subtle:     '#555555',
} as const;

const PAGE_W = 612; // LETTER points
const USABLE_W = PAGE_W - PAGE.margins.left - PAGE.margins.right; // 522

// Table columns (points) — 4 columns: #, Expediente, Derechohabiente, Especialidad
const COL = {
  num:          30,
  expediente:  130,
  paciente:    230,
  especialidad: 122,  // fills remainder: 30+130+230+122 = 512 (usable - 10 padding)
} as const;
const TABLE_W = COL.num + COL.expediente + COL.paciente + COL.especialidad; // 512

// ── Helpers ───────────────────────────────────────────────────────────────────

/** DD/MM/YYYY from a Date or ISO string portion */
function fmtDate(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  const day  = String(dt.getDate()).padStart(2, '0');
  const mon  = String(dt.getMonth() + 1).padStart(2, '0');
  const yr   = dt.getFullYear();
  return `${day}/${mon}/${yr}`;
}

/** Sanitize filename: replace spaces and slashes → dashes */
function safeVale(numeroVale: string): string {
  return numeroVale.replace(/[/\\\s]+/g, '-').replace(/[^\w.-]/g, '');
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class PDFKitValeArchivoGenerator implements ValeArchivoReportGeneratorPort {
  async generate(snapshot: ValeArchivoSnapshot): Promise<ValeArchivoReportResult> {
    if (snapshot.items.length === 0) {
      throw new Error('PDFKitValeArchivoGenerator: el vale no tiene ítems.');
    }

    const doc = new PDFDocument({
      size:          PAGE.size,
      margins:       PAGE.margins,
      bufferPages:   true,
      autoFirstPage: false,
    });

    doc.addPage();
    const finalY = renderDocument(doc, snapshot);
    void finalY;

    // Stamp page numbers
    const total = doc.bufferedPageRange().count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(i);
      stampFooter(doc, i + 1, total);
    }

    // Collect buffer
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    await new Promise<void>((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
      doc.end();
    });

    const stream = Readable.from([Buffer.concat(chunks)]);
    const datePart = snapshot.fechaSolicitud instanceof Date
      ? snapshot.fechaSolicitud.toISOString().slice(0, 10)
      : String(snapshot.fechaSolicitud).slice(0, 10);
    const filename = `sm1-14-${safeVale(snapshot.numeroVale)}-${datePart}.pdf`;

    return { stream, filename };
  }
}

// ── Document renderer ─────────────────────────────────────────────────────────

function renderDocument(
  doc:      InstanceType<typeof PDFDocument>,
  snapshot: ValeArchivoSnapshot,
): number {
  const L = PAGE.margins.left;
  let y   = PAGE.margins.top;

  // ── Institution header ────────────────────────────────────────────────────
  doc.font(FONT.bold).fontSize(9).fillColor(COLOR.black);
  doc.text('ISSSTE — ARCHIVO CLÍNICO', L, y, { width: USABLE_W, align: 'center' });
  y += 14;
  doc.font(FONT.regular).fontSize(8).fillColor(COLOR.subtle);
  doc.text('SOLICITUD DE PRÉSTAMO DE EXPEDIENTE CLÍNICO (SM 1-14)', L, y, {
    width: USABLE_W, align: 'center',
  });
  y += 18;

  // ── Separator ─────────────────────────────────────────────────────────────
  doc.moveTo(L, y).lineTo(L + USABLE_W, y).strokeColor(COLOR.rule).lineWidth(0.5).stroke();
  y += 10;

  // ── Request metadata ──────────────────────────────────────────────────────
  doc.font(FONT.regular).fontSize(9).fillColor(COLOR.black);

  const half = USABLE_W / 2;

  function labelValue(label: string, value: string, x: number, cy: number): void {
    doc.font(FONT.bold).text(label, x, cy, { continued: true });
    doc.font(FONT.regular).text(value);
  }

  labelValue('No. de Vale: ',         snapshot.numeroVale,                            L,          y);
  labelValue('Fecha de Solicitud: ',  fmtDate(snapshot.fechaSolicitud),               L + half,   y);
  y += 13;
  labelValue('Fecha de Recepción: ',  fmtDate(snapshot.fechaRecepcion),               L,          y);
  y += 13;
  labelValue('Unidad Solicitante: ',  snapshot.unidadSolicitante,                     L,          y);
  y += 13;
  labelValue('Solicitante: ',
    `${snapshot.solicitante.nombre} — ${snapshot.solicitante.cargo}`,                  L,          y);
  y += 13;
  labelValue('Autoriza: ',
    `${snapshot.autorizador.nombre} — ${snapshot.autorizador.cargo}`,                  L,          y);
  y += 16;

  // ── Separator ─────────────────────────────────────────────────────────────
  doc.moveTo(L, y).lineTo(L + USABLE_W, y).strokeColor(COLOR.rule).lineWidth(0.5).stroke();
  y += 10;

  // ── Table header ──────────────────────────────────────────────────────────
  const tableL = L + (USABLE_W - TABLE_W) / 2;   // center the narrower table
  doc.rect(tableL, y, TABLE_W, 18).fill(COLOR.headerBg);
  doc.font(FONT.bold).fontSize(8).fillColor(COLOR.headerText);
  let cx = tableL + 3;
  doc.text('#',              cx,          y + 5, { width: COL.num - 3 });
  cx += COL.num;
  doc.text('Expediente',     cx,          y + 5, { width: COL.expediente - 3 });
  cx += COL.expediente;
  doc.text('Derechohabiente', cx,         y + 5, { width: COL.paciente - 3 });
  cx += COL.paciente;
  doc.text('Especialidad',   cx,          y + 5, { width: COL.especialidad - 3 });
  y += 18;

  // ── Data rows ─────────────────────────────────────────────────────────────
  // Campos permitidos: expedienteNumero, pacienteNombre, especialidad.
  // Campos PROHIBIDOS: estadoBusqueda, ubicacionEncontrada, observaciones,
  //                    actorId, tenantId, fechaNacimiento, CURP, teléfono.
  doc.font(FONT.regular).fontSize(8).fillColor(COLOR.black);
  snapshot.items.forEach((item, idx) => {
    const rowH = 15;
    if (idx % 2 === 1) {
      doc.rect(tableL, y, TABLE_W, rowH).fill(COLOR.rowAlt);
    }
    doc.fillColor(COLOR.black);
    cx = tableL + 3;
    doc.text(String(idx + 1),       cx, y + 4, { width: COL.num - 3,          lineBreak: false });
    cx += COL.num;
    doc.text(item.expedienteNumero, cx, y + 4, { width: COL.expediente - 3,   lineBreak: false });
    cx += COL.expediente;
    doc.text(item.pacienteNombre,   cx, y + 4, { width: COL.paciente - 3,     lineBreak: false });
    cx += COL.paciente;
    doc.text(item.especialidad,     cx, y + 4, { width: COL.especialidad - 3, lineBreak: false });
    y += rowH;
  });

  // ── Total ─────────────────────────────────────────────────────────────────
  y += 6;
  doc.moveTo(tableL, y).lineTo(tableL + TABLE_W, y)
     .strokeColor(COLOR.rule).lineWidth(0.5).stroke();
  y += 8;
  doc.font(FONT.bold).fontSize(9).fillColor(COLOR.black);
  doc.text(`Total de expedientes solicitados: ${snapshot.items.length}`, tableL, y);
  y += 20;

  // ── Delivery section (if delivered) ──────────────────────────────────────
  if (snapshot.receptorEntrega !== null) {
    doc.moveTo(L, y).lineTo(L + USABLE_W, y)
       .strokeColor(COLOR.rule).lineWidth(0.5).stroke();
    y += 10;
    doc.font(FONT.regular).fontSize(9).fillColor(COLOR.black);
    labelValue('Recibió: ', snapshot.receptorEntrega, L, y);
    if (snapshot.entregadoAt !== null) {
      labelValue('Fecha de entrega: ', fmtDate(snapshot.entregadoAt), L + half, y);
    }
    y += 13;
  }

  return y;
}

// ── Footer ────────────────────────────────────────────────────────────────────

function stampFooter(
  doc:   InstanceType<typeof PDFDocument>,
  page:  number,
  total: number,
): void {
  const { left, right, bottom } = PAGE.margins;
  const usable  = doc.page.width - left - right;
  const footerY = doc.page.height - bottom + 8;
  doc.font(FONT.regular).fontSize(7).fillColor(COLOR.subtle)
     .text(`Página ${page} de ${total}`, left, footerY, { width: usable, align: 'right' });
}
