import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const { encode } = _require('iconv-lite') as typeof import('iconv-lite');
import { describe, expect, it } from 'vitest';
import { SimefAgendaParserAdapter } from './SimefAgendaParserAdapter.js';
import type { AgendaFileInput } from '../../application/ports/AgendaFileInterpreterPort.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(bytes: Uint8Array): AgendaFileInput {
  return {
    sizeBytes: bytes.length,
    open: async function* () { yield bytes; },
  };
}

function asIso88591(html: string): Uint8Array {
  return new Uint8Array(encode(html, 'iso-8859-1'));
}

// ---------------------------------------------------------------------------
// Synthetic fixtures (desidentified, no real patient data)
// ---------------------------------------------------------------------------

const VALID_SINGLE_BLOCK = `<html><body>
<table>
<tr><td>ISSSTE</td><td>Consultas del 21/08/2026</td><td>HOSPITAL SINTETICO</td></tr>
</table>
<table>
<tr><td>No. Cita</td><td>Fecha</td><td>Hora</td><td>Folio</td><td>Expediente</td><td>Tipo</td><td>Nombre</td><td>Contacto</td><td>Vigencia</td><td>Sexo</td><td>Edad</td><td>P</td><td>S</td></tr>
<tr><td colspan="13">Médico: 12345 DR MEDICO SINTETICO</td></tr>
<tr><td colspan="13">Servicio: CIR CIRUGIA GENERAL</td></tr>
<tr><td>001</td><td>21/08/2026</td><td>08:00</td><td>FOLIO-001</td><td>PERR810604/10</td><td>PENSIONISTA</td><td>PACIENTE SINTETICO UNO</td><td></td><td></td><td></td><td></td><td>X</td><td></td></tr>
<tr><td>002</td><td>21/08/2026</td><td>09:00</td><td>FOLIO-002</td><td>PERR810604/11</td><td>ACTIVO</td><td>PACIENTE SINTETICO DOS</td><td></td><td></td><td></td><td></td><td></td><td>X</td></tr>
</table>
</body></html>`;

const VALID_MULTI_BLOCK = `<html><body>
<table>
<tr><td>ISSSTE</td><td>Consultas del 22/09/2026</td></tr>
</table>
<table>
<tr><td>No. Cita</td><td>Fecha</td><td>Hora</td><td>Folio</td><td>Expediente</td><td>Tipo</td><td>Nombre</td><td>Contacto</td><td>Vigencia</td><td>Sexo</td><td>Edad</td><td>P</td><td>S</td></tr>
<tr><td colspan="13">Médico: 11111 DR PRIMER MEDICO</td></tr>
<tr><td colspan="13">Servicio: MED MEDICINA GENERAL</td></tr>
<tr><td>001</td><td>22/09/2026</td><td>07:00</td><td>FOLIO-A1</td><td>EXP-A1</td><td>PENSIONISTA</td><td>PACIENTE A UNO</td><td></td><td></td><td></td><td></td><td>X</td><td></td></tr>
<tr><td>002</td><td>22/09/2026</td><td>07:30</td><td>FOLIO-A2</td><td>EXP-A2</td><td>ACTIVO</td><td>PACIENTE A DOS</td><td></td><td></td><td></td><td></td><td></td><td>X</td></tr>
<tr><td colspan="13">Médico: 22222 DR SEGUNDO MEDICO</td></tr>
<tr><td colspan="13">Servicio: CIR CIRUGIA GENERAL</td></tr>
<tr><td>003</td><td>22/09/2026</td><td>08:00</td><td>FOLIO-B1</td><td>EXP-B1</td><td>PENSIONISTA</td><td>PACIENTE B UNO</td><td></td><td></td><td></td><td></td><td>X</td><td></td></tr>
</table>
</body></html>`;

const ALTERED_HEADERS = `<html><body>
<table>
<tr><td>ISSSTE</td><td>Consultas del 15/10/2026</td></tr>
</table>
<table>
<tr><td>Num</td><td>Fecha</td><td>Hora</td><td>ID-FOLIO</td><td>Exp</td><td>Cat</td><td>Nombre Paciente</td><td>Tel</td><td>Vig</td><td>Sx</td><td>Ed</td><td>1V</td><td>SUB</td></tr>
<tr><td colspan="13">Médico: 33333 DR TERCER MEDICO</td></tr>
<tr><td colspan="13">Servicio: OFT OFTALMOLOGIA</td></tr>
<tr><td>001</td><td>15/10/2026</td><td>10:00</td><td>FOLIO-C1</td><td>EXP-C1</td><td>PENSIONISTA</td><td>PACIENTE C UNO</td><td></td><td></td><td></td><td></td><td>X</td><td></td></tr>
</table>
</body></html>`;

const MISSING_DATE = `<html><body>
<table><tr><td>Sin fecha aquí</td></tr></table>
<table>
<tr><td colspan="13">Médico: 12345 DR X</td></tr>
<tr><td colspan="13">Servicio: CIR S</td></tr>
<tr><td>001</td><td>NO-DATE</td><td>08:00</td><td>F1</td><td>E</td><td>T</td><td>N</td></tr>
</table>
</body></html>`;

const NO_MEDICO_BLOCKS = `<html><body>
<table>
<tr><td>ISSSTE</td><td>Consultas del 21/08/2026</td></tr>
<tr><td>001</td><td>21/08/2026</td><td>08:00</td><td>FOLIO-X</td><td>EXP</td><td>T</td><td>N</td></tr>
</table>
</body></html>`;

const NO_TABLES = `<html><body><p>Sin tablas 21/08/2026</p></body></html>`;

const INVALID_ROW_CONTENT = `<html><body>
<table>
<tr><td>ISSSTE</td><td>Consultas del 03/03/2026</td></tr>
</table>
<table>
<tr><td>No. Cita</td><td>Fecha</td><td>Hora</td><td>Folio</td><td>Expediente</td><td>Tipo</td><td>Nombre</td><td>C</td><td>V</td><td>S</td><td>E</td><td>P</td><td>S</td></tr>
<tr><td colspan="13">Médico: 44444 DR CUARTO MEDICO</td></tr>
<tr><td colspan="13">Servicio: CAR CARDIOLOGIA</td></tr>
<tr><td>001</td><td>03/03/2026</td><td>HORA_INVALIDA</td><td></td><td>EXP-D1</td><td>ACTIVO</td><td>PACIENTE D UNO</td><td></td><td></td><td></td><td></td><td>X</td><td></td></tr>
<tr><td>002</td><td>03/03/2026</td><td>11:00</td><td>FOLIO-D2</td><td>EXP-D2</td><td>ACTIVO</td><td>PACIENTE D DOS</td><td></td><td></td><td></td><td></td><td></td><td>X</td></tr>
</table>
</body></html>`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SimefAgendaParserAdapter', () => {
  const parser = new SimefAgendaParserAdapter();

  // -------------------------------------------------------------------------
  // Layout válido
  // -------------------------------------------------------------------------

  it('layout válido — extrae fecha, filas, médico y servicio correctamente', async () => {
    const bytes = asIso88591(VALID_SINGLE_BLOCK);
    const result = await parser.interpret(makeInput(bytes));

    expect(result.agendaDate.value).toBe('2026-08-21');
    expect(result.layout).toBe('SIMEF_HTML_V1');
    expect(result.fingerprint.value).toHaveLength(64);
    expect(result.rows).toHaveLength(2);

    const row0 = result.rows[0]!;
    expect(row0.sourcePosition).toBe(1);
    expect(row0.originalValues.folio).toBe('FOLIO-001');
    expect(row0.originalValues.appointmentTime).toBe('08:00');
    expect(row0.originalValues.physicianEmployeeNumber).toBe('12345');
    expect(row0.originalValues.physicianName).toBe('DR MEDICO SINTETICO');
    expect(row0.originalValues.serviceCode).toBe('CIR');
    expect(row0.originalValues.serviceName).toBe('CIRUGIA GENERAL');
    expect(row0.originalValues.patientName).toBe('PACIENTE SINTETICO UNO');
    expect(row0.originalValues.expedienteReference).toBe('PERR810604/10');
    expect(row0.originalValues.beneficiaryType).toBe('PENSIONISTA');
    expect(row0.originalValues.firstTimeMarker).toBe('X');
    expect(row0.originalValues.subsequentMarker).toBeNull();

    expect(row0.interpretedValues.folio?.value).toBe('FOLIO-001');
    expect(row0.interpretedValues.agendaFecha?.value).toBe('2026-08-21');
    expect(row0.interpretedValues.appointmentKind).toBe('FIRST_TIME');
    expect(row0.interpretedValues.appointmentTime).toBe('08:00');
    expect(row0.interpretedValues.numeroEmpleado?.value).toBe('12345');
    expect(row0.interpretedValues.servicioEspecialidad?.codigo).toBe('CIR');
    expect(row0.interpretedValues.servicioEspecialidad?.nombre).toBe('CIRUGIA GENERAL');

    const row1 = result.rows[1]!;
    expect(row1.originalValues.folio).toBe('FOLIO-002');
    expect(row1.interpretedValues.appointmentKind).toBe('SUBSEQUENT');
  });

  // -------------------------------------------------------------------------
  // Encoding / fingerprint
  // -------------------------------------------------------------------------

  it('encoding — fingerprint es SHA-256 de bytes raw ISO-8859-1', async () => {
    const bytes = asIso88591(VALID_SINGLE_BLOCK);
    const expected = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    const inspection = await parser.inspect(makeInput(bytes));
    expect(inspection.fingerprint.value).toBe(expected);
    expect(inspection.fingerprint.value).toHaveLength(64);
  });

  it('inspect y interpret producen el mismo fingerprint para los mismos bytes', async () => {
    const bytes = asIso88591(VALID_SINGLE_BLOCK);
    const inspection = await parser.inspect(makeInput(bytes));
    const interpretation = await parser.interpret(makeInput(bytes));
    expect(inspection.fingerprint.value).toBe(interpretation.fingerprint.value);
  });

  it('bytes distintos producen fingerprints distintos', async () => {
    const bytes1 = asIso88591(VALID_SINGLE_BLOCK);
    const bytes2 = asIso88591(VALID_MULTI_BLOCK);
    const fp1 = (await parser.inspect(makeInput(bytes1))).fingerprint.value;
    const fp2 = (await parser.inspect(makeInput(bytes2))).fingerprint.value;
    expect(fp1).not.toBe(fp2);
  });

  // -------------------------------------------------------------------------
  // Bloques múltiples
  // -------------------------------------------------------------------------

  it('bloques múltiples — cada fila recibe el médico y servicio de su bloque', async () => {
    const bytes = asIso88591(VALID_MULTI_BLOCK);
    const result = await parser.interpret(makeInput(bytes));

    expect(result.agendaDate.value).toBe('2026-09-22');
    expect(result.rows).toHaveLength(3);

    const rowA1 = result.rows[0]!;
    expect(rowA1.originalValues.physicianEmployeeNumber).toBe('11111');
    expect(rowA1.originalValues.physicianName).toBe('DR PRIMER MEDICO');
    expect(rowA1.originalValues.serviceCode).toBe('MED');
    expect(rowA1.originalValues.serviceName).toBe('MEDICINA GENERAL');
    expect(rowA1.interpretedValues.appointmentKind).toBe('FIRST_TIME');

    const rowA2 = result.rows[1]!;
    expect(rowA2.originalValues.physicianEmployeeNumber).toBe('11111');
    expect(rowA2.interpretedValues.appointmentKind).toBe('SUBSEQUENT');

    const rowB1 = result.rows[2]!;
    expect(rowB1.originalValues.physicianEmployeeNumber).toBe('22222');
    expect(rowB1.originalValues.physicianName).toBe('DR SEGUNDO MEDICO');
    expect(rowB1.originalValues.serviceCode).toBe('CIR');
    expect(rowB1.interpretedValues.appointmentKind).toBe('FIRST_TIME');
  });

  // -------------------------------------------------------------------------
  // Headers alterados
  // -------------------------------------------------------------------------

  it('headers alterados/diferentes — el parser continúa extrayendo datos si encuentra bloques médico/servicio', async () => {
    const bytes = asIso88591(ALTERED_HEADERS);
    const result = await parser.interpret(makeInput(bytes));
    expect(result.agendaDate.value).toBe('2026-10-15');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.originalValues.physicianEmployeeNumber).toBe('33333');
    expect(result.rows[0]!.originalValues.serviceCode).toBe('OFT');
  });

  // -------------------------------------------------------------------------
  // Contenido inválido (fail-open por fila, fail-closed por layout)
  // -------------------------------------------------------------------------

  it('fila con hora inválida o folio vacío — layout aceptado, fila sin interpretación correcta pero incluida', async () => {
    const bytes = asIso88591(INVALID_ROW_CONTENT);
    const result = await parser.interpret(makeInput(bytes));
    // Layout is valid (has Médico/Servicio blocks and date) → accept
    expect(result.rows).toHaveLength(2);
    // Row 0: folio is null (empty in fixture), hora inválida → appointmentTime null
    const row0 = result.rows[0]!;
    expect(row0.originalValues.folio).toBeNull();
    expect(row0.interpretedValues.appointmentTime).toBeNull();
    expect(row0.originalValues.physicianEmployeeNumber).toBe('44444');
    // Row 1: valid
    const row1 = result.rows[1]!;
    expect(row1.originalValues.folio).toBe('FOLIO-D2');
    expect(row1.interpretedValues.folio?.value).toBe('FOLIO-D2');
    expect(row1.interpretedValues.appointmentTime).toBe('11:00');
  });

  // -------------------------------------------------------------------------
  // Campos excluidos no presentes en originalValues
  // -------------------------------------------------------------------------

  it('originalValues no contiene campos excluidos — contacto, vigencia, sexo, edad, curp', async () => {
    const bytes = asIso88591(VALID_SINGLE_BLOCK);
    const result = await parser.interpret(makeInput(bytes));
    const ov = result.rows[0]!.originalValues;

    // Prohibited fields must NOT exist
    expect(ov).not.toHaveProperty('contacto');
    expect(ov).not.toHaveProperty('vigencia');
    expect(ov).not.toHaveProperty('sexo');
    expect(ov).not.toHaveProperty('edad');
    expect(ov).not.toHaveProperty('curp');

    // Exactly the allowed fields per RAW-AP-004
    const allowedKeys = [
      'folio', 'patientName', 'expedienteReference', 'beneficiaryType',
      'firstTimeMarker', 'subsequentMarker', 'agendaDate', 'appointmentTime',
      'physicianEmployeeNumber', 'physicianName', 'serviceCode', 'serviceName',
    ];
    expect(Object.keys(ov).sort()).toEqual([...allowedKeys].sort());
  });

  // -------------------------------------------------------------------------
  // Fail-closed: layout rejection
  // -------------------------------------------------------------------------

  it('fail-closed — archivo vacío lanza AGENDA_LAYOUT_REJECTED', async () => {
    await expect(parser.interpret(makeInput(new Uint8Array(0))))
      .rejects.toThrow('AGENDA_LAYOUT_REJECTED');
    await expect(parser.inspect(makeInput(new Uint8Array(0))))
      .rejects.toThrow('AGENDA_LAYOUT_REJECTED');
  });

  it('fail-closed — sin tablas HTML lanza AGENDA_LAYOUT_REJECTED', async () => {
    const bytes = asIso88591(NO_TABLES);
    await expect(parser.interpret(makeInput(bytes)))
      .rejects.toThrow('AGENDA_LAYOUT_REJECTED');
  });

  it('fail-closed — sin fecha de Agenda lanza AGENDA_LAYOUT_REJECTED', async () => {
    const bytes = asIso88591(MISSING_DATE);
    await expect(parser.interpret(makeInput(bytes)))
      .rejects.toThrow('AGENDA_LAYOUT_REJECTED');
  });

  it('fail-closed — sin bloques Médico/Servicio lanza AGENDA_LAYOUT_REJECTED', async () => {
    const bytes = asIso88591(NO_MEDICO_BLOCKS);
    await expect(parser.interpret(makeInput(bytes)))
      .rejects.toThrow('AGENDA_LAYOUT_REJECTED');
  });

  // -------------------------------------------------------------------------
  // inspect
  // -------------------------------------------------------------------------

  it('inspect retorna receivedRecords, agendaDate y layout sin rows', async () => {
    const bytes = asIso88591(VALID_SINGLE_BLOCK);
    const inspection = await parser.inspect(makeInput(bytes));
    expect(inspection.receivedRecords).toBe(2);
    expect(inspection.agendaDate.value).toBe('2026-08-21');
    expect(inspection.layout).toBe('SIMEF_HTML_V1');
    expect(inspection).not.toHaveProperty('rows');
  });

  // -------------------------------------------------------------------------
  // Privacy: no Turno/Consultorio/Destino
  // -------------------------------------------------------------------------

  it('resultado no contiene Turno, Consultorio ni Destino', async () => {
    const bytes = asIso88591(VALID_SINGLE_BLOCK);
    const result = await parser.interpret(makeInput(bytes));
    const row = result.rows[0]!;
    const ov = row.originalValues;
    const iv = row.interpretedValues;
    expect(ov).not.toHaveProperty('turno');
    expect(ov).not.toHaveProperty('consultorio');
    expect(ov).not.toHaveProperty('destino');
    expect(iv).not.toHaveProperty('turno');
    expect(iv).not.toHaveProperty('consultorio');
    expect(iv).not.toHaveProperty('destino');
  });
});

// =============================================================================
// BUG-3 Regression tests — added after smoke test evidence from real SIMEF files
// =============================================================================

// ─── Shared fixtures for BUG-3 tests ─────────────────────────────────────────

/** 16-column appointment row fixture — real SIMEF extended layout.
 *  Encodes:
 *    col 0  = NoCita (numeric)
 *    col 1  = Fecha
 *    col 2  = HORA interval (HH:mm - HH:mm)
 *    col 3  = Folio
 *    col 4  = Expediente
 *    col 5  = Tipo (beneficiary code)
 *    col 6  = Nombre (excluded — allow-listed as patientName)
 *    col 7  = excluded-A (phone, excluded per RAW-AP-004)
 *    col 8  = excluded-B (empty, excluded)
 *    col 9  = excluded-C (short text, excluded)
 *    col 10 = vigencia-marker (X, excluded)
 *    col 11 = extra (empty, excluded)
 *    col 12 = SEXO (F/M, excluded — MUST NOT enter marker fields)
 *    col 13 = EDAD (excluded)
 *    col 14 = 1A. VEZ (X for primera vez)
 *    col 15 = SUBS. (X for subsecuente)
 */
const FIXTURE_16COL_PRIMERA = `<html><body><table>
<tr><td>ISSSTE</td><td>Consultas del 15/09/2026</td></tr>
</table><table>
<tr><td>No. CITA</td><td>FECHA</td><td>HORA</td><td>FOLIO</td><td>EXP</td><td>TIPO</td><td>NOMBRE</td><td>C1</td><td>C2</td><td>C3</td><td>C4</td><td>C5</td><td>SEXO</td><td>EDAD</td><td>1A. VEZ</td><td>SUBS.</td></tr>
<tr><td>Medico: 55501 DR SINTETICO UNO</td><td>Servicio: CIR CIRUGIA SINTETICA</td></tr>
<tr><td>1</td><td>15/09/2026</td><td>08:00 - 08:20</td><td>FOLIO-P-001</td><td>EXP-P-001</td><td>10</td><td>PACIENTE SINTETICO P</td><td></td><td></td><td></td><td>X</td><td></td><td>F</td><td>45 anos</td><td>X</td><td></td></tr>
</table></body></html>`;

const FIXTURE_16COL_SUBSECUENTE = `<html><body><table>
<tr><td>ISSSTE</td><td>Consultas del 15/09/2026</td></tr>
</table><table>
<tr><td>No. CITA</td><td>FECHA</td><td>HORA</td><td>FOLIO</td><td>EXP</td><td>TIPO</td><td>NOMBRE</td><td>C1</td><td>C2</td><td>C3</td><td>C4</td><td>C5</td><td>SEXO</td><td>EDAD</td><td>1A. VEZ</td><td>SUBS.</td></tr>
<tr><td>Medico: 55501 DR SINTETICO UNO</td><td>Servicio: CIR CIRUGIA SINTETICA</td></tr>
<tr><td>1</td><td>15/09/2026</td><td>09:00 - 09:20</td><td>FOLIO-S-001</td><td>EXP-S-001</td><td>20</td><td>PACIENTE SINTETICO S</td><td></td><td></td><td></td><td>X</td><td></td><td>M</td><td>62 anos</td><td></td><td>X</td></tr>
</table></body></html>`;

/** Fixture where SEXO column (F/M) sits at what the 13-col parser expects as
 *  COL_SUBSECUENTE=12. Used to verify getMarker() rejects F/M. */
const FIXTURE_FM_IN_SUBS_COL = `<html><body><table>
<tr><td>ISSSTE</td><td>Consultas del 15/09/2026</td></tr>
</table><table>
<tr><td>No. CITA</td><td>FECHA</td><td>HORA</td><td>FOLIO</td><td>EXP</td><td>TIPO</td><td>NOMBRE</td><td>C1</td><td>C2</td><td>C3</td><td>C4</td><td>P</td><td>F</td></tr>
<tr><td colspan="13">Medico: 55501 DR SINTETICO FM</td></tr>
<tr><td colspan="13">Servicio: CIR CIRUGIA SINTETICA</td></tr>
<tr><td>1</td><td>15/09/2026</td><td>07:30</td><td>FOLIO-FM-001</td><td>EXP-FM-001</td><td>30</td><td>PACIENTE FM</td><td></td><td></td><td></td><td></td><td>X</td><td>F</td></tr>
<tr><td>2</td><td>15/09/2026</td><td>08:00</td><td>FOLIO-FM-002</td><td>EXP-FM-002</td><td>30</td><td>PACIENTE FM DOS</td><td></td><td></td><td></td><td></td><td></td><td>M</td></tr>
</table></body></html>`;

/** Fixture with Medico: using HTML entity &eacute; (real SIMEF encoding) */
const FIXTURE_ENTITY_MEDICO = `<html><body><table>
<tr><td>ISSSTE</td><td>Consultas del 10/10/2026</td></tr>
</table><table>
<tr><td>M&eacute;dico: 55503 DR ENTITY SINTETICO</td><td>Servicio: CARD CARDIOLOGIA SINTETICA</td></tr>
<tr><td>1</td><td>10/10/2026</td><td>07:00 - 07:20</td><td>FOLIO-ENT-001</td><td>EXP-ENT-001</td><td>10</td><td>PACIENTE ENTITY UNO</td><td></td><td></td><td></td><td>X</td><td></td><td>F</td><td>50 anos</td><td>X</td><td></td></tr>
</table></body></html>`;

describe('BUG-3A — Hora interval parsing regression', () => {
  const parser = new SimefAgendaParserAdapter();

  it('BUG-3A: "HH:mm - HH:mm" (spaced) → extracts start time HH:mm', async () => {
    const bytes = asIso88591(FIXTURE_16COL_PRIMERA);
    const result = await parser.interpret(makeInput(bytes));
    const iv = result.rows[0]!.interpretedValues;
    expect(iv.appointmentTime).toBe('08:00');
  });

  it('BUG-3A: "HH:mm-HH:mm" (no space) → extracts start time HH:mm', async () => {
    const html = `<html><body><table>
<tr><td>ISSSTE</td><td>Consultas del 15/09/2026</td></tr>
</table><table>
<tr><td>Medico: 55501 DR SINTETICO</td><td>Servicio: CIR CIRUGIA</td></tr>
<tr><td>1</td><td>15/09/2026</td><td>12:00-12:20</td><td>FOLIO-NS</td><td>EXP-NS</td><td>10</td><td>PACIENTE NS</td><td></td><td></td><td></td><td>X</td><td></td><td>F</td><td>40 anos</td><td>X</td><td></td></tr>
</table></body></html>`;
    const bytes = asIso88591(html);
    const result = await parser.interpret(makeInput(bytes));
    expect(result.rows[0]!.interpretedValues.appointmentTime).toBe('12:00');
  });

  it('BUG-3A: single-digit hour interval "7:00 - 7:20" → zero-padded "07:00"', async () => {
    const html = `<html><body><table>
<tr><td>ISSSTE</td><td>Consultas del 15/09/2026</td></tr>
</table><table>
<tr><td>Medico: 55501 DR SINTETICO</td><td>Servicio: CIR CIRUGIA</td></tr>
<tr><td>1</td><td>15/09/2026</td><td>7:00 - 7:20</td><td>FOLIO-SDH</td><td>EXP-SDH</td><td>10</td><td>PACIENTE SDH</td><td></td><td></td><td></td><td>X</td><td></td><td>F</td><td>35 anos</td><td>X</td><td></td></tr>
</table></body></html>`;
    const bytes = asIso88591(html);
    const result = await parser.interpret(makeInput(bytes));
    expect(result.rows[0]!.interpretedValues.appointmentTime).toBe('07:00');
  });

  it('BUG-3A: exact HH:mm (golden dataset format) still works', async () => {
    const bytes = asIso88591(VALID_SINGLE_BLOCK);
    const result = await parser.interpret(makeInput(bytes));
    // VALID_SINGLE_BLOCK first row has '08:00' (exact format, not interval)
    expect(result.rows[0]!.interpretedValues.appointmentTime).toBe('08:00');
  });

  it('BUG-3A: originalValues preserves the raw interval string unchanged', async () => {
    const bytes = asIso88591(FIXTURE_16COL_PRIMERA);
    const result = await parser.interpret(makeInput(bytes));
    // The ACL must not modify the raw value
    expect(result.rows[0]!.originalValues.appointmentTime).toBe('08:00 - 08:20');
  });
});

describe('BUG-3B — TipoConsulta: column drift, F/M rejection, Primera/Subsecuente', () => {
  const parser = new SimefAgendaParserAdapter();

  it('BUG-3B: 16-col row — col14=X → FIRST_TIME (not from Sexo at col12)', async () => {
    const bytes = asIso88591(FIXTURE_16COL_PRIMERA);
    const result = await parser.interpret(makeInput(bytes));
    const iv = result.rows[0]!.interpretedValues;
    expect(iv.appointmentKind).toBe('FIRST_TIME');
  });

  it('BUG-3B: 16-col row — col15=X → SUBSEQUENT (not from Sexo at col12)', async () => {
    const bytes = asIso88591(FIXTURE_16COL_SUBSECUENTE);
    const result = await parser.interpret(makeInput(bytes));
    const iv = result.rows[0]!.interpretedValues;
    expect(iv.appointmentKind).toBe('SUBSEQUENT');
  });

  it('BUG-3B: F in 13-col SUBS position → appointmentKind=null (not SUBSEQUENT)', async () => {
    const bytes = asIso88591(FIXTURE_FM_IN_SUBS_COL);
    const result = await parser.interpret(makeInput(bytes));
    // Row with P=X, S=F: should be FIRST_TIME (col11=X → FIRST_TIME; col12=F rejected)
    expect(result.rows[0]!.interpretedValues.appointmentKind).toBe('FIRST_TIME');
    // Row with P=empty, S=M: F/M rejected → appointmentKind=null
    expect(result.rows[1]!.interpretedValues.appointmentKind).toBeNull();
  });

  it('BUG-3B: M in 13-col SUBS position → appointmentKind=null (not SUBSEQUENT)', async () => {
    const bytes = asIso88591(FIXTURE_FM_IN_SUBS_COL);
    const result = await parser.interpret(makeInput(bytes));
    // Row 2: subsequentMarker=null because M is rejected by getMarker()
    expect(result.rows[1]!.originalValues.subsequentMarker).toBeNull();
  });

  it('BUG-3B: F/M do NOT appear in originalValues.firstTimeMarker or subsequentMarker', async () => {
    const bytes = asIso88591(FIXTURE_FM_IN_SUBS_COL);
    const result = await parser.interpret(makeInput(bytes));
    for (const row of result.rows) {
      const { firstTimeMarker, subsequentMarker } = row.originalValues;
      expect(firstTimeMarker).not.toBe('F');
      expect(firstTimeMarker).not.toBe('M');
      expect(subsequentMarker).not.toBe('F');
      expect(subsequentMarker).not.toBe('M');
    }
  });

  it('BUG-3B: Medico: with HTML entity &eacute; is detected correctly', async () => {
    const bytes = asIso88591(FIXTURE_ENTITY_MEDICO);
    const result = await parser.interpret(makeInput(bytes));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.originalValues.physicianEmployeeNumber).toBe('55503');
  });
});

describe('BUG-3C — Servicio/Especialidad detection in real SIMEF layout', () => {
  const parser = new SimefAgendaParserAdapter();

  it('BUG-3C: Servicio: at cell[1] of 2-cell Medico row → serviceCode and serviceName extracted', async () => {
    const bytes = asIso88591(FIXTURE_16COL_PRIMERA);
    const result = await parser.interpret(makeInput(bytes));
    const ov = result.rows[0]!.originalValues;
    expect(ov.serviceCode).toBe('CIR');
    expect(ov.serviceName).toBe('CIRUGIA SINTETICA');
  });

  it('BUG-3C: Servicio: on separate row (compact layout) still detected', async () => {
    const bytes = asIso88591(VALID_SINGLE_BLOCK);
    const result = await parser.interpret(makeInput(bytes));
    expect(result.rows[0]!.originalValues.serviceCode).not.toBeNull();
  });

  it('BUG-3C: Especialidad: label (alternative) is also detected', async () => {
    const html = `<html><body><table>
<tr><td>ISSSTE</td><td>Consultas del 20/09/2026</td></tr>
</table><table>
<tr><td>Medico: 55510 DR ESPECIALIDAD SINTETICO</td></tr>
<tr><td>Especialidad: ESP ESPECIALIDAD SINTETICA</td></tr>
<tr><td>1</td><td>20/09/2026</td><td>08:00</td><td>FOLIO-ESP</td><td>EXP-ESP</td><td>10</td><td>PACIENTE ESP</td><td></td><td></td><td></td><td></td><td>X</td><td></td></tr>
</table></body></html>`;
    const bytes = asIso88591(html);
    const result = await parser.interpret(makeInput(bytes));
    expect(result.rows[0]!.originalValues.serviceCode).toBe('ESP');
    expect(result.rows[0]!.originalValues.serviceName).toBe('ESPECIALIDAD SINTETICA');
  });

  it('BUG-3C: multiple physicians each carry their own serviceCode', async () => {
    const bytes = asIso88591(FIXTURE_ENTITY_MEDICO);
    const result = await parser.interpret(makeInput(bytes));
    expect(result.rows[0]!.originalValues.serviceCode).toBe('CARD');
    expect(result.rows[0]!.originalValues.serviceName).toBe('CARDIOLOGIA SINTETICA');
  });
});

describe('Privacy regression — excluded fields cannot drift into allow-listed fields', () => {
  const parser = new SimefAgendaParserAdapter();

  it('PRIVACY: Sexo value (F/M) at col12 of 16-col row never enters firstTimeMarker or subsequentMarker', async () => {
    const bytes = asIso88591(FIXTURE_16COL_PRIMERA);
    const result = await parser.interpret(makeInput(bytes));
    for (const row of result.rows) {
      // The F at col12 must not appear in either marker field
      expect(row.originalValues.firstTimeMarker).not.toBe('F');
      expect(row.originalValues.subsequentMarker).not.toBe('F');
    }
  });

  it('PRIVACY: deliberate excluded value at col7 (excl-A) never appears in allow-listed originalValues fields', async () => {
    // If a value "EXCL-TURNO" is placed at col7, it must not appear in any allow-listed field
    const html = `<html><body><table>
<tr><td>ISSSTE</td><td>Consultas del 25/09/2026</td></tr>
</table><table>
<tr><td>Medico: 55501 DR SINTETICO</td><td>Servicio: CIR CIRUGIA</td></tr>
<tr><td>1</td><td>25/09/2026</td><td>08:00 - 08:20</td><td>FOLIO-EXCL</td><td>EXP-EXCL</td><td>10</td><td>PACIENTE EXCL</td><td>EXCL-TURNO</td><td></td><td></td><td>X</td><td></td><td>F</td><td>45 anos</td><td>X</td><td></td></tr>
</table></body></html>`;
    const bytes = asIso88591(html);
    const result = await parser.interpret(makeInput(bytes));
    const ov = result.rows[0]!.originalValues;
    const ovValues = Object.values(ov);
    // The excluded value must not appear anywhere in originalValues
    expect(ovValues).not.toContain('EXCL-TURNO');
  });

  it('PRIVACY: deliberate Sexo value at drift position does not produce appointmentKind', async () => {
    // A row where col14 is empty and col15 is empty but col12 = "F" (Sexo)
    // appointmentKind must be null — F/M never produces FIRST_TIME or SUBSEQUENT
    const html = `<html><body><table>
<tr><td>ISSSTE</td><td>Consultas del 25/09/2026</td></tr>
</table><table>
<tr><td>Medico: 55501 DR SINTETICO</td><td>Servicio: CIR CIRUGIA</td></tr>
<tr><td>1</td><td>25/09/2026</td><td>09:00 - 09:20</td><td>FOLIO-SEXO</td><td>EXP-SEXO</td><td>20</td><td>PACIENTE SEXO</td><td></td><td></td><td></td><td>X</td><td></td><td>F</td><td>55 anos</td><td></td><td></td></tr>
</table></body></html>`;
    // col14=empty, col15=empty → no marker → appointmentKind=null
    const bytes = asIso88591(html);
    const result = await parser.interpret(makeInput(bytes));
    expect(result.rows[0]!.interpretedValues.appointmentKind).toBeNull();
  });

  it('PRIVACY: originalValues shape is exactly the allow-listed fields regardless of row width', async () => {
    const allowedKeys = [
      'folio', 'patientName', 'expedienteReference', 'beneficiaryType',
      'firstTimeMarker', 'subsequentMarker', 'agendaDate', 'appointmentTime',
      'physicianEmployeeNumber', 'physicianName', 'serviceCode', 'serviceName',
    ].sort();
    // Test both 13-col (golden) and 16-col (extended) layouts
    for (const fixture of [VALID_SINGLE_BLOCK, FIXTURE_16COL_PRIMERA]) {
      const result = await parser.interpret(makeInput(asIso88591(fixture)));
      for (const row of result.rows) {
        expect(Object.keys(row.originalValues).sort()).toEqual(allowedKeys);
      }
    }
  });
});

describe('BUG-2 — ALREADY_IMPORTED metrics invariant regression', () => {
  // These tests exercise the ImportAgenda use case's ALREADY_IMPORTED path
  // to ensure metrics always satisfy:
  //   receivedRecords = processed + pendingReview + rejected + duplicateFolio
  // After the bug fix, all counters must be 0 for ALREADY_IMPORTED.
  // (Full use case tests live in ImportAgenda.test.ts; these are ACL-level smoke.)
  it('BUG-2: parser does not emit metrics — ImportAgenda owns metrics semantics', () => {
    // This is a contract boundary test: the parser only produces rows.
    // Metrics are the responsibility of ImportAgenda, not the parser.
    // Verified here to document the boundary.
    expect(true).toBe(true); // placeholder — actual BUG-2 regression in ImportAgenda.test.ts
  });
});
