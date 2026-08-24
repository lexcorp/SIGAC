/**
 * T-18 — E2E: Agenda Preparation
 *
 * Covers the authorized real flow via the API directly (no web UI routing required):
 *   - import válido → 201 IMPORTED, métricas canónicas, respuesta sin PII técnica
 *   - idempotencia: mismo fingerprint → ALREADY_IMPORTED
 *   - snapshot cambiado → RECONCILED con withdrawn/added correctos
 *   - retirada preservada y restauración via reconciliación sucesiva
 *   - layout inválido → 422 AGENDA_LAYOUT_REJECTED sanitizado
 *   - sin permiso AGENDA_IMPORT → 403 PERMISSION_DENIED
 *   - tenant isolation: importación de Tenant B no es visible desde Tenant A
 *
 * All tests use the real NestJS server (api-server.ts), real PostgreSQL migrations,
 * and synthetic desidentified fixtures.  No PII real, no raw content exposed.
 *
 * Actor selection is via the `sigac_e2e_actor` cookie understood by the harness resolver.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

/**
 * Builds a minimal synthetic SIMEF HTML payload (ASCII / ISO-8859-1 safe).
 * The layout satisfies all SimefAgendaParserAdapter requirements:
 *   - at least one <table>
 *   - a DD/MM/YYYY date string in the document text
 *   - at least one "Medico:" block header
 * Row cells follow the column order expected by COL_* constants.
 */
function buildSimefHtml(opts: {
  dateStr: string; // DD/MM/YYYY
  rows: ReadonlyArray<{ num: string; folio: string; hora: string; nombre: string }>;
}): Buffer {
  const rowsHtml = opts.rows
    .map(
      (r) =>
        `<tr>` +
        `<td>${r.num}</td>` +           // COL 0: No. Cita
        `<td>${opts.dateStr}</td>` +    // COL 1: Fecha
        `<td>${r.hora}</td>` +          // COL 2: Hora
        `<td>${r.folio}</td>` +         // COL 3: Folio
        `<td>EXP-E2E-${r.num}</td>` +  // COL 4: Expediente
        `<td>PENSIONISTA</td>` +        // COL 5: Tipo derechohabiente
        `<td>${r.nombre}</td>` +        // COL 6: Nombre
        `<td></td>` +                   // COL 7: contacto (excluded)
        `<td></td>` +                   // COL 8: vigencia (excluded)
        `<td></td>` +                   // COL 9: sexo (excluded)
        `<td></td>` +                   // COL 10: edad (excluded)
        `<td>X</td>` +                  // COL 11: Primera vez
        `<td></td>` +                   // COL 12: Subsecuente
        `</tr>`,
    )
    .join('\n');

  const html =
    `<html><body>` +
    `<table><tr><td>ISSSTE</td><td>Consultas del ${opts.dateStr}</td><td>HOSPITAL E2E</td></tr></table>` +
    `<table>` +
    `<tr><td>No. Cita</td><td>Fecha</td><td>Hora</td><td>Folio</td><td>Expediente</td>` +
    `<td>Tipo</td><td>Nombre</td><td>C</td><td>V</td><td>S</td><td>E</td><td>P</td><td>S2</td></tr>` +
    `<tr><td>Medico: 55501 DR E2E SINTETICO</td></tr>` +
    `<tr><td>Servicio: CIR CIRUGIA E2E</td></tr>` +
    rowsHtml +
    `</table>` +
    `</body></html>`;

  return Buffer.from(html, 'ascii');
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

interface PostResult {
  status: number;
  body: Record<string, unknown>;
}

async function postImport(
  request: APIRequestContext,
  file: Buffer,
  idempotencyKey: string,
  actor = 'agendaImport',
): Promise<PostResult> {
  const response = await request.post('http://localhost:3000/api/v1/agenda-imports', {
    multipart: {
      file: {
        name: 'agenda.xls',
        mimeType: 'application/vnd.ms-excel',
        buffer: file,
      },
    },
    headers: {
      'Idempotency-Key': idempotencyKey,
      Cookie: `sigac_e2e_actor=${actor}`,
    },
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // non-JSON body — leave empty
  }
  return { status: response.status(), body };
}

// ---------------------------------------------------------------------------
// T-18 scenarios
// ---------------------------------------------------------------------------

test.describe.serial('T-18 — Agenda Preparation E2E', () => {
  // -------------------------------------------------------------------------
  // 1. Import válido → 201 IMPORTED, métricas canónicas, sin PII técnica
  // -------------------------------------------------------------------------
  test('import válido produce 201 IMPORTED con métricas canónicas y sin PII técnica', async ({ request }) => {
    const html = buildSimefHtml({
      dateStr: '25/08/2026',
      rows: [
        { num: '001', folio: 'E2E-FOLIO-001', hora: '08:00', nombre: 'PACIENTE E2E UNO' },
        { num: '002', folio: 'E2E-FOLIO-002', hora: '08:30', nombre: 'PACIENTE E2E DOS' },
      ],
    });

    const { status, body } = await postImport(request, html, `e2e-first-${randomUUID()}`);

    expect(status).toBe(201);
    expect(body.outcome).toBe('IMPORTED');
    expect(body.agendaDate).toBe('2026-08-25');
    expect(typeof body.importacionId).toBe('string');
    expect(typeof body.importedAt).toBe('string');

    // Métricas correctas para 2 citas ADD
    const metrics = body.metrics as Record<string, number>;
    expect(metrics.receivedRecords).toBe(2);
    expect(metrics.added).toBe(2);
    expect(metrics.updated).toBe(0);
    expect(metrics.unchanged).toBe(0);
    expect(metrics.withdrawnFromAgenda).toBe(0);

    // REQ-AP-014: ecuación de conteos
    expect(metrics.receivedRecords).toBe(
      metrics.added + metrics.updated + metrics.unchanged + metrics.restored +
      metrics.pendingReview + metrics.rejected + metrics.duplicateFolio,
    );

    // UX sin PII técnica (REQ-AP-015, AC-AP-010)
    const json = JSON.stringify(body);
    expect(json).not.toMatch(/fingerprint/i);
    expect(json).not.toMatch(/filename/i);
    expect(json).not.toMatch(/rawRow|raw_row/i);
    expect(json).not.toMatch(/curp/i);
    expect(json).not.toContain('importAttemptId');

    // Response shape: only approved top-level keys (API-AP-008)
    expect(Object.keys(body).sort()).toEqual(
      ['agendaDate', 'importacionId', 'importedAt', 'metrics', 'outcome'].sort(),
    );
  });

  // -------------------------------------------------------------------------
  // 2. Idempotencia: mismo fingerprint (mismo bytes) → ALREADY_IMPORTED
  // -------------------------------------------------------------------------
  test('idempotencia: mismo artefacto (mismo fingerprint) → ALREADY_IMPORTED', async ({ request }) => {
    const html = buildSimefHtml({
      dateStr: '26/08/2026',
      rows: [{ num: '001', folio: 'E2E-IDEM-001', hora: '09:00', nombre: 'PACIENTE IDEM UNO' }],
    });

    // Primera importación
    const first = await postImport(request, html, `e2e-idem-first-${randomUUID()}`);
    expect(first.status).toBe(201);
    expect(first.body.outcome).toBe('IMPORTED');

    // Segunda importación: nueva Idempotency-Key pero mismo artefacto (mismo fingerprint)
    const second = await postImport(request, html, `e2e-idem-second-${randomUUID()}`);
    expect(second.status).toBe(201);
    expect(second.body.outcome).toBe('ALREADY_IMPORTED');
  });

  // -------------------------------------------------------------------------
  // 3. Snapshot cambiado → RECONCILED
  // -------------------------------------------------------------------------
  test('snapshot cambiado produce RECONCILED con withdrawn y added correctos', async ({ request }) => {
    const dateStr = '27/08/2026';

    // V1: 2 citas
    const htmlV1 = buildSimefHtml({
      dateStr,
      rows: [
        { num: '001', folio: 'E2E-REC-001', hora: '07:00', nombre: 'PACIENTE REC UNO' },
        { num: '002', folio: 'E2E-REC-002', hora: '07:30', nombre: 'PACIENTE REC DOS' },
      ],
    });
    const v1 = await postImport(request, htmlV1, `e2e-rec-v1-${randomUUID()}`);
    expect(v1.status).toBe(201);
    expect(v1.body.outcome).toBe('IMPORTED');

    // V2: E2E-REC-001 hora cambia (UPDATE), E2E-REC-002 ausente (WITHDRAWN), nuevo E2E-REC-003 (ADD)
    const htmlV2 = buildSimefHtml({
      dateStr,
      rows: [
        { num: '001', folio: 'E2E-REC-001', hora: '08:00', nombre: 'PACIENTE REC UNO' },
        { num: '003', folio: 'E2E-REC-003', hora: '09:00', nombre: 'PACIENTE REC TRES' },
      ],
    });
    const v2 = await postImport(request, htmlV2, `e2e-rec-v2-${randomUUID()}`);
    expect(v2.status).toBe(201);
    expect(v2.body.outcome).toBe('RECONCILED');

    const metrics = v2.body.metrics as Record<string, number>;
    // E2E-REC-001 changed hora → UPDATE
    expect(metrics.updated).toBeGreaterThanOrEqual(1);
    // E2E-REC-003 is new → ADD
    expect(metrics.added).toBeGreaterThanOrEqual(1);
    // E2E-REC-002 absent in V2 → WITHDRAWN
    expect(metrics.withdrawnFromAgenda).toBeGreaterThanOrEqual(1);
    // All rows accounted for (REQ-AP-014)
    expect(metrics.receivedRecords).toBe(
      metrics.added + metrics.updated + metrics.unchanged + metrics.restored +
      metrics.pendingReview + metrics.rejected + metrics.duplicateFolio,
    );
  });

  // -------------------------------------------------------------------------
  // 4. Retirada preservada y restauración via reconciliación (REQ-AP-009, AC-AP-005)
  // -------------------------------------------------------------------------
  test('retirada preservada y restauración via reconciliación sucesiva', async ({ request }) => {
    const dateStr = '28/08/2026';

    // V1: E2E-W-001 activa
    const htmlV1 = buildSimefHtml({
      dateStr,
      rows: [{ num: '001', folio: 'E2E-W-001', hora: '10:00', nombre: 'PACIENTE W UNO' }],
    });
    const v1 = await postImport(request, htmlV1, `e2e-w-v1-${randomUUID()}`);
    expect(v1.status).toBe(201);
    expect(v1.body.outcome).toBe('IMPORTED');

    // V2: E2E-W-001 ausente (→ WITHDRAWN), E2E-W-002 nueva
    const htmlV2 = buildSimefHtml({
      dateStr,
      rows: [{ num: '002', folio: 'E2E-W-002', hora: '11:00', nombre: 'PACIENTE W DOS' }],
    });
    const v2 = await postImport(request, htmlV2, `e2e-w-v2-${randomUUID()}`);
    expect(v2.status).toBe(201);
    expect(v2.body.outcome).toBe('RECONCILED');
    const v2metrics = v2.body.metrics as Record<string, number>;
    // E2E-W-001 should be withdrawn
    expect(v2metrics.withdrawnFromAgenda).toBeGreaterThanOrEqual(1);

    // V3: E2E-W-001 reaparece (→ RESTORE), E2E-W-002 continúa (→ UNCHANGED)
    const htmlV3 = buildSimefHtml({
      dateStr,
      rows: [
        { num: '001', folio: 'E2E-W-001', hora: '10:00', nombre: 'PACIENTE W UNO' },
        { num: '002', folio: 'E2E-W-002', hora: '11:00', nombre: 'PACIENTE W DOS' },
      ],
    });
    const v3 = await postImport(request, htmlV3, `e2e-w-v3-${randomUUID()}`);
    expect(v3.status).toBe(201);
    expect(v3.body.outcome).toBe('RECONCILED');
    const v3metrics = v3.body.metrics as Record<string, number>;
    // E2E-W-001 restored (same identity, not a new Cita)
    expect(v3metrics.restored).toBeGreaterThanOrEqual(1);
    // E2E-W-002 unchanged
    expect(v3metrics.unchanged).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // 5. Layout inválido → 422 AGENDA_LAYOUT_REJECTED sanitizado (REQ-AP-002, AC-AP-006)
  // -------------------------------------------------------------------------
  test('layout inválido produce 422 AGENDA_LAYOUT_REJECTED sanitizado', async ({ request }) => {
    // Plain HTML with no Medico: block, no valid date, no rows → rejected by parser
    const malformed = Buffer.from(
      '<html><body><p>No es un archivo SIMEF valido</p></body></html>',
      'ascii',
    );

    const response = await request.post('http://localhost:3000/api/v1/agenda-imports', {
      multipart: {
        file: {
          name: 'not-simef.xls',
          mimeType: 'application/vnd.ms-excel',
          buffer: malformed,
        },
      },
      headers: {
        'Idempotency-Key': `e2e-layout-${randomUUID()}`,
        Cookie: 'sigac_e2e_actor=agendaImport',
      },
    });

    expect(response.status()).toBe(422);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe('AGENDA_LAYOUT_REJECTED');
    expect(body.status).toBe(422);

    // importAttemptId must be present and opaque
    expect(typeof body.importAttemptId).toBe('string');

    // Sanitised: no internal parser details, no stack trace
    const json = JSON.stringify(body);
    expect(json).not.toMatch(/stack/i);
    expect(json).not.toMatch(/\bSQL\b/i);
    expect(json).not.toMatch(/filepath|filesystem/i);
    expect(json).not.toMatch(/charset|encoding|EUC|ISO-8859/i);
    expect(json).not.toMatch(/htmlparser|domutils/i);
  });

  // -------------------------------------------------------------------------
  // 6. Sin permiso AGENDA_IMPORT → 403 PERMISSION_DENIED, no divulga actor interno
  // -------------------------------------------------------------------------
  test('sin permiso AGENDA_IMPORT retorna 403 PERMISSION_DENIED no divulgativo', async ({ request }) => {
    const html = buildSimefHtml({
      dateStr: '29/08/2026',
      rows: [{ num: '001', folio: 'E2E-DENIED-001', hora: '08:00', nombre: 'PACIENTE DENIED' }],
    });

    // agendaView actor has AGENDA_VIEW but NOT AGENDA_IMPORT
    const { status, body } = await postImport(
      request,
      html,
      `e2e-denied-${randomUUID()}`,
      'agendaView',
    );

    expect(status).toBe(403);
    expect(body.code).toBe('PERMISSION_DENIED');

    // Must not disclose internal actor / permission detail
    const json = JSON.stringify(body);
    expect(json).not.toContain('e2e-agenda-view');
    expect(json).not.toContain('AGENDA_IMPORT');
    expect(json).not.toContain('actorId');
  });

  // -------------------------------------------------------------------------
  // 7. Tenant isolation: importación de Tenant B invisible desde Tenant A (AC-AP-011)
  // -------------------------------------------------------------------------
  test('tenant isolation: importacion de Tenant B no es visible desde Tenant A', async ({ request }) => {
    const html = buildSimefHtml({
      dateStr: '30/08/2026',
      rows: [{ num: '001', folio: 'E2E-TB-001', hora: '08:00', nombre: 'PACIENTE TENANT B' }],
    });

    // Import into Tenant B
    const resultB = await postImport(request, html, `e2e-tb-${randomUUID()}`, 'agendaTenantB');
    expect(resultB.status).toBe(201);
    const importacionIdB = resultB.body.importacionId as string;
    expect(typeof importacionIdB).toBe('string');

    // GET the importación from Tenant A — must return 404, not cross-tenant data
    const getFromA = await request.get(
      `http://localhost:3000/api/v1/agenda-imports/${importacionIdB}`,
      { headers: { Cookie: 'sigac_e2e_actor=agendaView' } },
    );
    expect(getFromA.status()).toBe(404);
    const notFound = (await getFromA.json()) as Record<string, unknown>;
    expect(notFound.code).toBe('AGENDA_IMPORT_NOT_FOUND');

    // Non-disclosing: must not hint at cross-tenant existence
    const json = JSON.stringify(notFound);
    expect(json).not.toContain('CROSS_TENANT');
    expect(json).not.toContain('e2e-b');
    expect(json).not.toContain('agendaTenantB');
  });
});
