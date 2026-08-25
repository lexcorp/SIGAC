/**
 * PDFKitPreparationReportGenerator
 *
 * Infrastructure adapter implementing PreparationReportGeneratorPort using PDFKit.
 *
 * Source: preparation-reports design.md §6, ADR-0030, ADR-0031 v1.1.
 * Spec: REQ-PR-002, REQ-PR-003, REQ-PR-004, REQ-PR-009.
 *
 * Constraints:
 * - Imports deriveShift from @sigac/agenda-preparation (NOT reimplemented here).
 * - Uses bufferPages:true so total page count can be stamped in footers.
 * - Produces a Readable stream; never writes to filesystem.
 * - Never receives or renders fields outside PreparationItem.
 * - Prohibited fields: CURP, DOB, phone, email, age, sex, diagnoses.
 */

import { Readable } from 'node:stream';
import PDFDocument from 'pdfkit';
import type {
  PreparationReportGeneratorPort,
  ReportGenerationRequest,
  ReportGenerationResult,
} from '@sigac/agenda-preparation';
import { deriveShift } from '@sigac/agenda-preparation';
import type { PreparationItem } from '@sigac/agenda-preparation';

// ─── Layout constants ─────────────────────────────────────────────────────────

const PAGE = {
  size:    'LETTER' as const,
  margins: { top: 40, bottom: 50, left: 40, right: 40 },
} as const;

const FONT = {
  regular: 'Helvetica',
  bold:    'Helvetica-Bold',
} as const;

const COLOR = {
  black:      '#000000',
  headerBg:   '#1a1a2e',
  headerText: '#ffffff',
  rowAlt:     '#f5f5f5',
  rule:       '#cccccc',
} as const;

// Column widths (points) for the data table
const COL = {
  hora:       55,
  expediente: 100,
  paciente:   185,
  folio:      120,
} as const;
const TABLE_WIDTH = COL.hora + COL.expediente + COL.paciente + COL.folio; // 460

// ─── Grouping helpers ─────────────────────────────────────────────────────────

interface Group {
  serviceCodigo:  string;
  serviceNombre:  string;
  employeeNumber: string;
  medicoNombre:   string;
  items:          readonly PreparationItem[];
}

function buildGroups(items: readonly PreparationItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const item of items) {
    const key = `${item.servicioEspecialidad.codigo}|${item.medico.numeroEmpleado}`;
    if (!map.has(key)) {
      map.set(key, {
        serviceCodigo:  item.servicioEspecialidad.codigo,
        serviceNombre:  item.servicioEspecialidad.nombre,
        employeeNumber: item.medico.numeroEmpleado,
        medicoNombre:   item.medico.nombre,
        items:          [],
      });
    }
    (map.get(key)!.items as PreparationItem[]).push(item);
  }
  // Sort: service ASC → employee ASC → time ASC (items already sorted by caller)
  return [...map.values()].sort((a, b) => {
    const sc = a.serviceCodigo.localeCompare(b.serviceCodigo);
    if (sc !== 0) return sc;
    return a.employeeNumber.localeCompare(b.employeeNumber);
  });
}

// ─── Date formatting (DD/MM/YYYY) ─────────────────────────────────────────────

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d ?? '??'}/${m ?? '??'}/${y ?? '????'}`;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class PDFKitPreparationReportGenerator
  implements PreparationReportGeneratorPort
{
  async generate(request: ReportGenerationRequest): Promise<ReportGenerationResult> {
    const { agendaDate, items, order: _order } = request;

    if (items.length === 0) {
      throw new Error('PDFKitPreparationReportGenerator: items array must not be empty');
    }

    const groups = buildGroups(items);

    // bufferPages:true lets us write the total page count in footers afterward.
    const doc = new PDFDocument({
      size:        PAGE.size,
      margins:     PAGE.margins,
      bufferPages: true,
      autoFirstPage: false,
    });

    // ── Generate pages ────────────────────────────────────────────────────────
    groups.forEach((group, idx) => {
      doc.addPage();
      renderGroup(doc, group, agendaDate);
      // First group rendered — subsequent groups are always a new page (already handled by addPage above)
      void idx; // suppress unused warning
    });

    // ── Stamp total pages in footers ──────────────────────────────────────────
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      stampFooter(doc, i + 1, totalPages);
    }

    // ── Collect all buffered output into a Buffer ────────────────────────────
    // PDFKit with bufferPages:true emits all data synchronously on end().
    // We collect it before calling end() via the 'data' event, then build
    // the readable from the accumulated bytes.
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const stream = Readable.from([pdfBuffer]);
    const filename = `lista-preparacion-${agendaDate}.pdf`;

    return { stream, filename };
  }
}

// ─── Page renderer ────────────────────────────────────────────────────────────

function renderGroup(
  doc:       InstanceType<typeof PDFDocument>,
  group:     Group,
  agendaDate: string,
): void {
  const left    = PAGE.margins.left;
  const top     = PAGE.margins.top;
  const usableW = TABLE_WIDTH;
  const shift   = deriveShift(group.items[0]!.appointmentTime);   // ADR-0031

  let y = top;

  // ── Institution header ────────────────────────────────────────────────────
  doc.font(FONT.bold).fontSize(9).fillColor(COLOR.black);
  doc.text('SISTEMA DE INFORMACIÓN MÉDICO FINANCIERO', left, y, { width: usableW, align: 'center' });
  y += 14;
  doc.text('ARCHIVO CLÍNICO', left, y, { width: usableW, align: 'center' });
  y += 14;
  doc.font(FONT.bold).fontSize(10);
  doc.text('LISTA DE EXPEDIENTES PARA CONSULTA', left, y, { width: usableW, align: 'center' });
  y += 20;

  // ── Separator line ────────────────────────────────────────────────────────
  doc.moveTo(left, y).lineTo(left + usableW, y).strokeColor(COLOR.rule).lineWidth(0.5).stroke();
  y += 8;

  // ── Block metadata ────────────────────────────────────────────────────────
  doc.font(FONT.regular).fontSize(9).fillColor(COLOR.black);

  const metaLeft  = left;
  const metaRight = left + usableW / 2;

  doc.font(FONT.bold).text('Fecha de consulta: ', metaLeft, y, { continued: true });
  doc.font(FONT.regular).text(`${formatDate(agendaDate)}`, { continued: false });

  doc.font(FONT.bold).text('Turno: ', metaRight, y, { continued: true });
  doc.font(FONT.regular).text(shift, { continued: false });
  y += 14;

  doc.font(FONT.bold).text('Servicio: ', metaLeft, y, { continued: true });
  doc.font(FONT.regular).text(`${group.serviceNombre} (${group.serviceCodigo})`);
  y += 14;

  doc.font(FONT.bold).text('Médico: ', metaLeft, y, { continued: true });
  doc.font(FONT.regular).text(group.medicoNombre);
  y += 14;

  doc.font(FONT.bold).text('No. Empleado: ', metaLeft, y, { continued: true });
  doc.font(FONT.regular).text(group.employeeNumber);
  y += 16;

  // ── Table header ──────────────────────────────────────────────────────────
  doc.rect(left, y, usableW, 18).fill(COLOR.headerBg);

  doc.font(FONT.bold).fontSize(9).fillColor(COLOR.headerText);
  let cx = left + 4;
  doc.text('Hora',           cx,                   y + 5, { width: COL.hora - 4 });
  cx += COL.hora;
  doc.text('Expediente',     cx,                   y + 5, { width: COL.expediente - 4 });
  cx += COL.expediente;
  doc.text('Derechohabiente', cx,                  y + 5, { width: COL.paciente - 4 });
  cx += COL.paciente;
  doc.text('Folio',          cx,                   y + 5, { width: COL.folio - 4 });
  y += 18;

  // ── Data rows ─────────────────────────────────────────────────────────────
  doc.font(FONT.regular).fontSize(8).fillColor(COLOR.black);

  group.items.forEach((item, rowIdx) => {
    const rowH = 16;
    if (rowIdx % 2 === 1) {
      doc.rect(left, y, usableW, rowH).fill(COLOR.rowAlt);
    }
    doc.fillColor(COLOR.black);

    cx = left + 4;
    doc.text(item.appointmentTime,         cx, y + 4, { width: COL.hora - 4,       lineBreak: false });
    cx += COL.hora;
    doc.text(item.expediente.original,     cx, y + 4, { width: COL.expediente - 4, lineBreak: false });
    cx += COL.expediente;
    // nombrePaciente is in PreparationItem; allowed per REQ-PR-003 and minimization rules.
    doc.text(item.nombrePaciente,          cx, y + 4, { width: COL.paciente - 4,   lineBreak: false });
    cx += COL.paciente;
    doc.text(item.folio,                   cx, y + 4, { width: COL.folio - 4,      lineBreak: false });
    y += rowH;
  });

  // ── Footer rule + total ───────────────────────────────────────────────────
  y += 4;
  doc.moveTo(left, y).lineTo(left + usableW, y).strokeColor(COLOR.rule).lineWidth(0.5).stroke();
  y += 8;

  doc.font(FONT.bold).fontSize(9).fillColor(COLOR.black);
  doc.text(`Total de expedientes: ${group.items.length}`, left, y, { width: usableW });
}

// ─── Page number footer ───────────────────────────────────────────────────────

function stampFooter(
  doc:        InstanceType<typeof PDFDocument>,
  pageNumber: number,
  total:      number,
): void {
  const { left, right, bottom } = PAGE.margins;
  const pageW     = doc.page.width;
  const usableW   = pageW - left - right;
  const footerY   = doc.page.height - bottom + 8;

  doc
    .font(FONT.regular)
    .fontSize(8)
    .fillColor(COLOR.black)
    .text(`Página ${pageNumber} de ${total}`, left, footerY, {
      width: usableW,
      align: 'right',
    });
}


