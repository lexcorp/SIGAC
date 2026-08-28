/**
 * PDFKitPreparationReportGenerator
 *
 * Infrastructure adapter implementing PreparationReportGeneratorPort using PDFKit.
 *
 * Source: preparation-reports design.md §6 v0.1.2, ADR-0030, ADR-0031 v1.1.
 * Spec: REQ-PR-002, REQ-PR-003, REQ-PR-004, REQ-PR-009.
 *
 * T-28.2 changes:
 * - Orientation: landscape (LETTER 792×612 pts) — REQ-PR-009 v0.1.2
 * - Added columns: Tipo DH + Cita (Primera vez / Subsecuente) — REQ-PR-003 v0.1.2
 * - Widths recalculated to use 712 pt usable width
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
  layout:  'landscape' as const,   // T-28.2: landscape = 792×612 pts
  margins: { top: 36, bottom: 46, left: 36, right: 36 },
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

// Landscape usable width: 792 − 36 − 36 = 720 pts
// T-28.2 columns: Hora | Expediente | Derechohabiente | Tipo DH | Cita | Folio
const COL = {
  hora:       52,
  expediente: 100,
  paciente:   195,
  tipoDH:     70,   // T-28.2: tipoDerechohabiente
  cita:       75,   // T-28.2: Primera vez / Subsecuente
  folio:      100,
} as const;

const TABLE_WIDTH =
  COL.hora + COL.expediente + COL.paciente +
  COL.tipoDH + COL.cita + COL.folio; // 592

const TABLE_HEADER_HEIGHT = 18;
const ROW_HEIGHT = 15;
const GROUP_TOTAL_HEIGHT = 26;
const CONTENT_BOTTOM_GAP = 8;

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
  // Sort: service ASC → employee ASC (items already sorted by caller per SERVICE_MEDICO_HORA_ASC)
  return [...map.values()].sort((a, b) => {
    const sc = a.serviceCodigo.localeCompare(b.serviceCodigo);
    if (sc !== 0) return sc;
    return a.employeeNumber.localeCompare(b.employeeNumber);
  });
}

// ─── Label helpers ────────────────────────────────────────────────────────────

function citaLabel(tipoConsulta: 'FIRST_TIME' | 'SUBSEQUENT'): string {
  return tipoConsulta === 'FIRST_TIME' ? 'Primera vez' : 'Subsecuente';
}

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

    const doc = new PDFDocument({
      size:          PAGE.size,
      layout:        PAGE.layout,    // T-28.2: landscape
      margins:       PAGE.margins,
      bufferPages:   true,
      autoFirstPage: false,
    });

    groups.forEach((group) => {
      renderGroup(doc, group, agendaDate);
    });

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      stampFooter(doc, i + 1, totalPages);
    }

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const stream   = Readable.from([pdfBuffer]);
    const filename = `lista-preparacion-${agendaDate}.pdf`;

    return { stream, filename };
  }
}

// ─── Page renderer ────────────────────────────────────────────────────────────

function renderGroup(
  doc:        InstanceType<typeof PDFDocument>,
  group:      Group,
  agendaDate: string,
): void {
  let y = addGroupPage(doc, group, agendaDate);
  const contentBottom = () => doc.page.height - PAGE.margins.bottom - CONTENT_BOTTOM_GAP;

  group.items.forEach((item, rowIdx) => {
    const isLastRow = rowIdx === group.items.length - 1;
    const requiredHeight = ROW_HEIGHT + (isLastRow ? GROUP_TOTAL_HEIGHT : 0);

    if (y + requiredHeight > contentBottom()) {
      y = addGroupPage(doc, group, agendaDate);
    }

    renderDataRow(doc, item, rowIdx, y);
    y += ROW_HEIGHT;
  });

  renderGroupTotal(doc, group.items.length, y);
}

/**
 * Starts every physical page of a physician group with the complete report
 * context and table header. Continuation pages therefore never contain
 * orphan rows without service/physician/column information.
 */
function addGroupPage(
  doc:        InstanceType<typeof PDFDocument>,
  group:      Group,
  agendaDate: string,
): number {
  doc.addPage();

  const left    = PAGE.margins.left;
  const top     = PAGE.margins.top;
  const usableW = TABLE_WIDTH;
  const shift   = deriveShift(group.items[0]!.appointmentTime);   // ADR-0031

  let y = top;

  // ── Institution header ────────────────────────────────────────────────────
  doc.font(FONT.bold).fontSize(9).fillColor(COLOR.black);
  doc.text('SISTEMA DE INFORMACIÓN MÉDICO FINANCIERO', left, y, { width: usableW, align: 'center' });
  y += 13;
  doc.text('ARCHIVO CLÍNICO', left, y, { width: usableW, align: 'center' });
  y += 13;
  doc.font(FONT.bold).fontSize(10);
  doc.text('LISTA DE EXPEDIENTES PARA CONSULTA', left, y, { width: usableW, align: 'center' });
  y += 18;

  doc.moveTo(left, y).lineTo(left + usableW, y).strokeColor(COLOR.rule).lineWidth(0.5).stroke();
  y += 8;

  // ── Block metadata ────────────────────────────────────────────────────────
  const metaLeft  = left;
  const metaRight = left + usableW / 2;

  doc.font(FONT.bold).fontSize(9).fillColor(COLOR.black);
  doc.text('Fecha de consulta: ', metaLeft, y, { continued: true });
  doc.font(FONT.regular).text(formatDate(agendaDate), { continued: false });
  doc.font(FONT.bold).text('Turno: ', metaRight, y, { continued: true });
  doc.font(FONT.regular).text(shift, { continued: false });
  y += 13;

  doc.font(FONT.bold).text('Servicio: ', metaLeft, y, { continued: true });
  doc.font(FONT.regular).text(`${group.serviceNombre} (${group.serviceCodigo})`);
  y += 13;
  doc.font(FONT.bold).text('Médico: ', metaLeft, y, { continued: true });
  doc.font(FONT.regular).text(group.medicoNombre);
  y += 13;
  doc.font(FONT.bold).text('No. Empleado: ', metaLeft, y, { continued: true });
  doc.font(FONT.regular).text(group.employeeNumber);
  y += 14;

  // ── Table header ──────────────────────────────────────────────────────────
  doc.rect(left, y, usableW, TABLE_HEADER_HEIGHT).fill(COLOR.headerBg);
  doc.font(FONT.bold).fontSize(8).fillColor(COLOR.headerText);

  let cx = left + 3;
  doc.text('Hora',           cx, y + 5, { width: COL.hora - 3 });       cx += COL.hora;
  doc.text('Expediente',     cx, y + 5, { width: COL.expediente - 3 }); cx += COL.expediente;
  doc.text('Derechohabiente', cx, y + 5, { width: COL.paciente - 3 });  cx += COL.paciente;
  doc.text('Tipo DH',        cx, y + 5, { width: COL.tipoDH - 3 });     cx += COL.tipoDH;
  doc.text('Cita',           cx, y + 5, { width: COL.cita - 3 });       cx += COL.cita;
  doc.text('Folio',          cx, y + 5, { width: COL.folio - 3 });
  return y + TABLE_HEADER_HEIGHT;
}

function renderDataRow(
  doc:    InstanceType<typeof PDFDocument>,
  item:   PreparationItem,
  rowIdx: number,
  y:      number,
): void {
  const left = PAGE.margins.left;
  if (rowIdx % 2 === 1) {
    doc.rect(left, y, TABLE_WIDTH, ROW_HEIGHT).fill(COLOR.rowAlt);
  }
  doc.font(FONT.regular).fontSize(7.5).fillColor(COLOR.black);

  let cx = left + 3;
  doc.text(item.appointmentTime,         cx, y + 4, { width: COL.hora - 3,       lineBreak: false }); cx += COL.hora;
  doc.text(item.expediente.original,     cx, y + 4, { width: COL.expediente - 3, lineBreak: false }); cx += COL.expediente;
  doc.text(item.nombrePaciente,          cx, y + 4, { width: COL.paciente - 3,   lineBreak: false }); cx += COL.paciente;
  doc.text(item.tipoDerechohabiente,     cx, y + 4, { width: COL.tipoDH - 3,     lineBreak: false }); cx += COL.tipoDH;
  doc.text(citaLabel(item.tipoConsulta), cx, y + 4, { width: COL.cita - 3,       lineBreak: false }); cx += COL.cita;
  doc.text(item.folio,                   cx, y + 4, { width: COL.folio - 3,      lineBreak: false });
}

function renderGroupTotal(
  doc:   InstanceType<typeof PDFDocument>,
  total: number,
  y:     number,
): void {
  const left = PAGE.margins.left;

  // ── Footer rule + total ───────────────────────────────────────────────────
  y += 4;
  doc.moveTo(left, y).lineTo(left + TABLE_WIDTH, y).strokeColor(COLOR.rule).lineWidth(0.5).stroke();
  y += 7;
  doc.font(FONT.bold).fontSize(8.5).fillColor(COLOR.black);
  doc.text(`Total de expedientes: ${total}`, left, y, { width: TABLE_WIDTH });
}

// ─── Page number footer ───────────────────────────────────────────────────────

function stampFooter(
  doc:        InstanceType<typeof PDFDocument>,
  pageNumber: number,
  total:      number,
): void {
  const { left, right, bottom } = PAGE.margins;
  const pageW   = doc.page.width;
  const usableW = pageW - left - right;
  const footerY = doc.page.height - bottom + 8;
  const originalBottomMargin = doc.page.margins.bottom;

  // The footer lives in the reserved bottom margin. PDFKit otherwise interprets
  // this y coordinate as overflowing flowing content and creates another page.
  // Disable that boundary only while stamping the selected buffered page.
  doc.page.margins.bottom = 0;
  try {
    doc
      .font(FONT.regular)
      .fontSize(7.5)
      .fillColor(COLOR.black)
      .text(`Página ${pageNumber} de ${total}`, left, footerY, {
        width: usableW,
        align: 'right',
        lineBreak: false,
      });
  } finally {
    doc.page.margins.bottom = originalBottomMargin;
  }
}
