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
