import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const { decode } = _require('iconv-lite') as typeof import('iconv-lite');
import { parseDocument } from 'htmlparser2';
import { getElementsByTagName, textContent } from 'domutils';
import {
  AgendaFecha,
  FolioCita,
  NumeroEmpleado,
  ServicioEspecialidad,
} from '../../domain/value-objects/index.js';
import type {
  AgendaFileInput,
  AgendaFileInspection,
  AgendaFileInterpreterPort,
  ImportFingerprint,
  InterpretedAgendaFile,
  ParsedAgendaRow,
} from '../../application/ports/AgendaFileInterpreterPort.js';
import type {
  RegistroImportadoAgendaOriginalValues,
  RegistroImportadoAgendaInterpretedValues,
} from '../../domain/entities/RegistroImportadoAgenda.js';

const LAYOUT_ID = 'SIMEF_HTML_V1';
// Trailing (?!\d) instead of \b: textContent() concatenates cells without
// separators, so the year digit may be immediately followed by a word char
// (e.g. "2026HOSPITAL"). \b would fail in that case; (?!\d) is sufficient.
const DATE_PATTERN = /\b(\d{2})\/(\d{2})\/(\d{4})(?!\d)/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;
// SIMEF real artifacts represent appointments as intervals: "HH:mm - HH:mm" or "HH:mm-HH:mm"
// The domain uses HoraCita = HH:mm (start time only).
// This pattern extracts the start time from both formats.
const TIME_INTERVAL_PATTERN = /^(\d{1,2}):(\d{2})\s*-\s*\d{1,2}:\d{2}$/;

// ─── Column indices per observed SIMEF layout (0-based) ────────────────────────
// All SIMEF variants share cols 0-6.
const COL_NO_CITA   = 0;
const COL_FECHA     = 1;
const COL_HORA      = 2;
const COL_FOLIO     = 3;
const COL_EXPEDIENTE = 4;
const COL_TIPO      = 5;
const COL_NOMBRE    = 6;

// Layout variant A — 13-column rows (golden-dataset / SIMEF compact):
// col 7=CONTACTO, 8=VIGENCIA, 9=SEXO*, 10=EDAD*, 11=1A.VEZ, 12=SUBS.
// * excluded fields — never read into allow-listed fields
const COL_PRIMERA_VEZ_13 = 11;
const COL_SUBSECUENTE_13  = 12;

// Layout variant B — 16-column rows (real SIMEF extended with extra excluded cols):
// col 7=CONTACTO, 8=CELULAR*, 9=EMAIL*, 10=VIGENCIA*, 11=?(marker-like),
// 12=SEXO*, 13=EDAD*, 14=1A.VEZ, 15=SUBS.
// Confirmed by structural analysis of two real SIMEF artifacts.
// * excluded fields — never read into allow-listed fields
const COL_PRIMERA_VEZ_16 = 14;
const COL_SUBSECUENTE_16  = 15;

/** Returns the correct Primera Vez column index for the given row column count. */
function colPrimeraVez(nCols: number): number {
  return nCols >= 16 ? COL_PRIMERA_VEZ_16 : COL_PRIMERA_VEZ_13;
}
/** Returns the correct Subsecuente column index for the given row column count. */
function colSubsecuente(nCols: number): number {
  return nCols >= 16 ? COL_SUBSECUENTE_16 : COL_SUBSECUENTE_13;
}

// Privacy boundary: excluded column ranges by layout variant.
// Any value at these positions must NEVER enter allow-listed original fields.
// Used by privacy regression tests.
const EXCLUDED_COL_RANGES_13 = [
  { start: 7, end: 10, label: 'contacto/vigencia/sexo/edad' },
] as const;
const EXCLUDED_COL_RANGES_16 = [
  { start: 7, end: 13, label: 'celular/email/vigencia/sexo/edad/extra' },
] as const;

/** Returns the excluded column ranges for the given row size (for testing). */
export function excludedColRanges(nCols: number) {
  return nCols >= 16 ? EXCLUDED_COL_RANGES_16 : EXCLUDED_COL_RANGES_13;
}

export class SimefAgendaParserAdapter implements AgendaFileInterpreterPort {
  async inspect(input: AgendaFileInput): Promise<AgendaFileInspection> {
    const result = await this.parseFile(input);
    return {
      fingerprint: result.fingerprint,
      layout: LAYOUT_ID,
      agendaDate: result.agendaDate,
      receivedRecords: result.rows.length,
    };
  }

  async interpret(input: AgendaFileInput): Promise<InterpretedAgendaFile> {
    const result = await this.parseFile(input);
    return {
      fingerprint: result.fingerprint,
      layout: LAYOUT_ID,
      agendaDate: result.agendaDate,
      rows: result.rows,
    };
  }

  private async parseFile(input: AgendaFileInput): Promise<{
    fingerprint: ImportFingerprint;
    agendaDate: AgendaFecha;
    rows: ParsedAgendaRow[];
  }> {
    // Collect all bytes from the AsyncIterable stream
    const chunks: Buffer[] = [];
    for await (const chunk of input.open()) {
      chunks.push(Buffer.from(chunk));
    }
    const rawBytes = Buffer.concat(chunks);

    if (rawBytes.length === 0) {
      throw new Error('AGENDA_LAYOUT_REJECTED: archivo vacío');
    }

    // Fingerprint from raw bytes (before encoding conversion)
    const fingerprint: ImportFingerprint = {
      value: createHash('sha256').update(rawBytes).digest('hex'),
    };

    // Decode ISO-8859-1 → string (handles real SIMEF encoding)
    const htmlContent = decode(rawBytes, 'iso-8859-1');

    // Parse HTML DOM
    const document = parseDocument(htmlContent, { decodeEntities: true });
    const tables = getElementsByTagName('table', document, true);
    if (tables.length === 0) {
      throw new Error('AGENDA_LAYOUT_REJECTED: sin tablas HTML');
    }

    // Extract date from full document text
    const allText = textContent(document);
    const dateMatch = DATE_PATTERN.exec(allText);
    if (!dateMatch) {
      throw new Error('AGENDA_LAYOUT_REJECTED: no se encontró fecha de Agenda');
    }
    const agendaDateStr = `${dateMatch[3]!}-${dateMatch[2]!}-${dateMatch[1]!}`;
    const agendaDate = AgendaFecha.parse(agendaDateStr);

    // Parse blocks and rows
    const rows: ParsedAgendaRow[] = [];
    let sourcePosition = 0;
    let currentPhysicianNumber: string | null = null;
    let currentPhysicianName: string | null = null;
    let currentServiceCode: string | null = null;
    let currentServiceName: string | null = null;
    let foundMedicoBlock = false;

    for (const table of tables) {
      const trElements = getElementsByTagName('tr', table, true);
      for (const tr of trElements) {
        // recursive=true is required: getElementsByTagName with recursive=false
        // tests only the node itself, not its children.
        const tdElements = getElementsByTagName('td', tr, true);
        if (tdElements.length === 0) continue;

        const cellTexts = tdElements.map((td) => textContent(td).trim());
        const firstCell = cellTexts[0] ?? '';

        // Detect Médico: block header (handles accented and non-accented)
        if (/^M[eé]dico:/i.test(firstCell)) {
          const rest = firstCell.replace(/^M[eé]dico:\s*/i, '').trim();
          const parts = rest.split(/\s+/);
          currentPhysicianNumber = parts[0] ?? null;
          currentPhysicianName = parts.length > 1 ? parts.slice(1).join(' ') : null;
          foundMedicoBlock = true;

          // Real SIMEF artefacts may embed Servicio/Especialidad in the SAME row
          // as the Médico block, in a subsequent cell (not firstCell).
          // Scan all remaining cells of the same row for the service label.
          for (let ci = 1; ci < cellTexts.length; ci++) {
            const cell = cellTexts[ci] ?? '';
            const serviceMatch = /^(?:Servicio|Especialidad):\s*/i.exec(cell);
            if (serviceMatch) {
              const serviceRest = cell.slice(serviceMatch[0].length).trim();
              const serviceParts = serviceRest.split(/\s+/);
              currentServiceCode = serviceParts[0] ?? null;
              currentServiceName = serviceParts.length > 1 ? serviceParts.slice(1).join(' ') : null;
              break;
            }
          }
          continue;
        }

        // Detect Servicio/Especialidad: block header on its own row
        // Handles both "Servicio:" and "Especialidad:" label variants used by real SIMEF.
        if (/^(?:Servicio|Especialidad):/i.test(firstCell)) {
          const rest = firstCell.replace(/^(?:Servicio|Especialidad):\s*/i, '').trim();
          const parts = rest.split(/\s+/);
          currentServiceCode = parts[0] ?? null;
          currentServiceName = parts.length > 1 ? parts.slice(1).join(' ') : null;
          continue;
        }

        // Skip column header rows — detected by non-numeric first cell
        // (covers "No. Cita", "Num", "no.", or any label variant)
        const noCita = cellTexts[COL_NO_CITA] ?? '';
        const folio = cellTexts[COL_FOLIO] ?? '';
        if (noCita !== '' && !/^\d+$/.test(noCita)) {
          continue;
        }

        // Skip empty spacing rows (both no.cita and folio are empty)
        if (tdElements.length < 5 || (noCita === '' && folio === '')) {
          continue;
        }

        // This is an appointment row
        sourcePosition++;
        const ov = buildOriginalValues(
          cellTexts,
          currentPhysicianNumber,
          currentPhysicianName,
          currentServiceCode,
          currentServiceName,
          cellTexts.length,
        );
        const iv = buildInterpretedValues(ov, agendaDateStr);
        rows.push({ sourcePosition, originalValues: ov, interpretedValues: iv });
      }
    }

    if (!foundMedicoBlock) {
      throw new Error('AGENDA_LAYOUT_REJECTED: no se encontraron bloques médico/servicio');
    }

    return { fingerprint, agendaDate, rows };
  }
}

function get(cells: string[], idx: number): string | null {
  const val = cells[idx]?.trim() ?? '';
  return val === '' ? null : val;
}

/**
 * Reads a marker cell (Primera Vez / Subsecuente).
 * Only returns the value if it is a recognized marker ('X' or 'x').
 * Real SIMEF artefacts have shown that position drift can cause a Sexo column
 * ('F'/'M') to appear in what the parser expects to be a marker column.
 * F/M are excluded because they are Sexo values (excluded field per RAW-AP-004)
 * and must never be stored as appointment-kind markers.
 * Returns null for any non-marker value.
 */
function getMarker(cells: string[], idx: number): string | null {
  const val = cells[idx]?.trim() ?? '';
  // Only 'X' (any case) is a valid marker; reject F/M (Sexo) and any other value.
  return /^[Xx]$/.test(val) ? val.toUpperCase() : null;
}

function buildOriginalValues(
  cells: string[],
  physicianEmployeeNumber: string | null,
  physicianName: string | null,
  serviceCode: string | null,
  serviceName: string | null,
  nCols: number = cells.length,
): RegistroImportadoAgendaOriginalValues {
  return {
    folio: get(cells, COL_FOLIO),
    patientName: get(cells, COL_NOMBRE),
    expedienteReference: get(cells, COL_EXPEDIENTE),
    beneficiaryType: get(cells, COL_TIPO),
    // Column indices for Primera/Subsecuente vary by row width.
    // 13-col rows (compact SIMEF): cols 11/12.
    // 16-col rows (extended SIMEF): cols 14/15.
    // getMarker() additionally rejects F/M (Sexo) at any position.
    firstTimeMarker: getMarker(cells, colPrimeraVez(nCols)),
    subsequentMarker: getMarker(cells, colSubsecuente(nCols)),
    agendaDate: get(cells, COL_FECHA),
    appointmentTime: get(cells, COL_HORA),
    physicianEmployeeNumber,
    physicianName,
    serviceCode,
    serviceName,
  };
}

function buildInterpretedValues(
  ov: RegistroImportadoAgendaOriginalValues,
  agendaDateStr: string,
): RegistroImportadoAgendaInterpretedValues {
  // folio
  let folio: RegistroImportadoAgendaInterpretedValues['folio'] = null;
  if (ov.folio !== null) {
    try { folio = FolioCita.parse(ov.folio); } catch { /* null */ }
  }

  // agendaFecha — prefer header date, fallback to row date
  let agendaFecha: RegistroImportadoAgendaInterpretedValues['agendaFecha'] = null;
  try { agendaFecha = AgendaFecha.parse(agendaDateStr); } catch { /* null */ }
  if (agendaFecha === null && ov.agendaDate !== null) {
    const m = DATE_PATTERN.exec(ov.agendaDate);
    if (m) {
      try { agendaFecha = AgendaFecha.parse(`${m[3]!}-${m[2]!}-${m[1]!}`); } catch { /* null */ }
    }
  }

  // appointmentKind
  let appointmentKind: RegistroImportadoAgendaInterpretedValues['appointmentKind'] = null;
  if (ov.firstTimeMarker?.trim().toUpperCase() === 'X') appointmentKind = 'FIRST_TIME';
  else if (ov.subsequentMarker?.trim().toUpperCase() === 'X') appointmentKind = 'SUBSEQUENT';

  // appointmentTime — normalize to HH:mm
  // Handles both "HH:mm" (golden fixture format) and "HH:mm - HH:mm" / "HH:mm-HH:mm"
  // (real SIMEF interval format). Only the start time is used per domain contract.
  let appointmentTime: string | null = null;
  if (ov.appointmentTime !== null) {
    const raw = ov.appointmentTime.trim();
    // Try exact HH:mm first (synthetic/test fixtures)
    const tmExact = TIME_PATTERN.exec(raw);
    if (tmExact) {
      appointmentTime = `${String(parseInt(tmExact[1]!, 10)).padStart(2, '0')}:${tmExact[2]!}`;
    } else {
      // Try interval format: extract start time before the dash
      const tmInterval = TIME_INTERVAL_PATTERN.exec(raw);
      if (tmInterval) {
        appointmentTime = `${String(parseInt(tmInterval[1]!, 10)).padStart(2, '0')}:${tmInterval[2]!}`;
      }
    }
  }

  // numeroEmpleado
  let numeroEmpleado: RegistroImportadoAgendaInterpretedValues['numeroEmpleado'] = null;
  if (ov.physicianEmployeeNumber !== null) {
    try { numeroEmpleado = NumeroEmpleado.parse(ov.physicianEmployeeNumber); } catch { /* null */ }
  }

  // servicioEspecialidad
  let servicioEspecialidad: RegistroImportadoAgendaInterpretedValues['servicioEspecialidad'] = null;
  if (ov.serviceCode !== null && ov.serviceName !== null) {
    try {
      servicioEspecialidad = ServicioEspecialidad.create({
        codigo: ov.serviceCode,
        nombre: ov.serviceName,
      });
    } catch { /* null */ }
  }

  return {
    folio,
    agendaFecha,
    beneficiaryType: ov.beneficiaryType,
    appointmentKind,
    appointmentTime,
    numeroEmpleado,
    servicioEspecialidad,
  };
}
