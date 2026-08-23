import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = new URL('../../openapi/sigac-v1.yaml', import.meta.url);
const contract = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const includes = (fragment, message) => assert.ok(contract.includes(fragment), message);
const excludes = (fragment, message) => assert.ok(!contract.includes(fragment), message);

includes('openapi: 3.1.0', 'OpenAPI 3.1 header is required');

const expedientePaths = [...contract.matchAll(/^  (\/expedientes[^:]*):$/gm)].map((match) => match[1]);
assert.deepEqual(expedientePaths, [
  '/expedientes',
  '/expedientes/{id}',
  '/expedientes/{id}/timeline',
  '/expedientes/{id}/audit',
  '/expedientes/{id}/dispatch',
  '/expedientes/{id}/accept-custody',
], 'Expediente Workspace must expose exactly the six approved Expediente paths');

for (const operationId of ['searchExpedientesByNumero', 'getExpediente', 'getExpedienteTimeline',
  'getExpedienteAudit', 'dispatchExpediente', 'acceptCustody', 'getSessionAuthorization',
  'listUbicaciones']) {
  includes(`operationId: ${operationId}`, `Missing operation ${operationId}`);
}

includes('  /session:', 'Session endpoint is required');
includes('  /ubicaciones:', 'Ubicaciones endpoint is required');
const sessionSchema = contract.match(/    SessionAuthorizationReadModel:\n([\s\S]*?)    DecimalBigint:/)?.[1] ?? '';
assert.match(sessionSchema, /required: \[actorId, permissions\]/, 'Session exposes actorId and permissions');
for (const forbidden of ['roles', 'tenantIds', 'capabilities', 'claims', 'databaseName']) {
  assert.doesNotMatch(sessionSchema, new RegExp(`\\b${forbidden}\\b`), `Session must not expose ${forbidden}`);
}
const auditSchema = contract.match(/    ExpedienteAuditEntrySummary:\n([\s\S]*?)    ExpedienteAuditPage:/)?.[1] ?? '';
assert.match(auditSchema, /required: \[auditId, action, result, actorRef, occurredAt, source, requestId, correlationId\]/,
  'Audit summary must contain exactly sanitized fields');
for (const forbidden of ['changeSummary', 'securityContext', 'tenant', 'source_ip_hash']) {
  assert.doesNotMatch(auditSchema, new RegExp(`\\b${forbidden}\\b`), `Audit must not expose ${forbidden}`);
}
const locationsSchema = contract.match(/    UbicacionOption:\n([\s\S]*?)    UbicacionesResponse:/)?.[1] ?? '';
assert.match(locationsSchema, /required: \[id, codigo, descripcion\]/, 'UbicacionOption exact fields');

const searchPathBlock = contract.match(/  \/expedientes:\n([\s\S]*?)  \/expedientes\/\{id\}:/)?.[1] ?? '';
assert.match(searchPathBlock, /name: numero\n\s+required: true/, 'Search numero query must be required');
assert.match(searchPathBlock, /ExpedienteSearchResponse/, 'Search must return ExpedienteSearchResponse');
assert.match(searchPathBlock, /'200':/, 'Empty and non-empty searches return HTTP 200');
assert.match(searchPathBlock, /'400':/, 'Invalid numero returns HTTP 400');
assert.match(searchPathBlock, /'401':/, 'Unauthenticated search returns HTTP 401');
assert.match(searchPathBlock, /'403':/, 'Unauthorized search returns HTTP 403');
assert.match(searchPathBlock, /PermissionDenied/, 'Search 403 must use PERMISSION_DENIED');
assert.doesNotMatch(searchPathBlock, /'404':/, 'An empty search is not HTTP 404');
assert.doesNotMatch(searchPathBlock, /\b(total|pagination|nextCursor)\b/, 'Search is not paginated and has no total');

const searchItemBlock = contract.match(/    ExpedienteSearchItem:\n([\s\S]*?)    ExpedienteSearchResponse:/)?.[1] ?? '';
assert.match(searchItemBlock,
  /required: \[expedienteId, expedienteNumero, paciente, estadoOperativo, ubicacion\]/,
  'Search item must contain exactly the approved top-level fields');
for (const forbidden of ['rowVersion', 'updatedAt', 'custodia', 'prestamo', 'solicitud',
  'incidencias', 'capabilities', 'timeline', 'audit']) {
  assert.doesNotMatch(searchItemBlock, new RegExp(`\\b${forbidden}\\b`, 'i'),
    `Search item must not expose ${forbidden}`);
}
const searchResponseBlock = contract.match(/    ExpedienteSearchResponse:\n([\s\S]*?)    PacienteReferenciaSummary:/)?.[1] ?? '';
assert.match(searchResponseBlock, /required: \[items\]/, 'Search response must wrap items');
assert.doesNotMatch(searchResponseBlock, /\b(total|pagination|nextCursor)\b/,
  'Search response must not expose pagination metadata');
const searchPacienteBlock = contract.match(/    ExpedienteSearchPaciente:\n([\s\S]*?)    ExpedienteSearchItem:/)?.[1] ?? '';
assert.match(searchPacienteBlock,
  /required: \[idInstitucional, curp, nombreOperativo, numeroIssste\]/,
  'Search patient must contain exactly the four canonical fields');

assert.equal((contract.match(/^        '204':$/gm) ?? []).length, 2, 'Both commands must define 204');
assert.equal((contract.match(/no response body\.$/gm) ?? []).length, 2, '204 responses must have no content');
includes("pattern: '^[0-9]+$'", 'Decimal bigint pattern is required');
includes('rowVersion: { $ref:', 'rowVersion must use DecimalBigint');
assert.equal((contract.match(/expectedRowVersion: \{ \$ref: '#\/components\/schemas\/DecimalBigint' \}/g) ?? []).length, 2,
  'Both commands must use DecimalBigint for expectedRowVersion');

const estadoBlock = contract.match(/    EstadoOperativo:\n([\s\S]*?)    Ubicacion:/)?.[1] ?? '';
for (const estado of ['DISPONIBLE', 'APARTADO', 'EN_TRASLADO', 'EN_CONSULTA', 'NO_LOCALIZADO', 'EXTRAVIADO']) {
  includes(estado, `Missing EstadoOperativo ${estado}`);
}
assert.match(estadoBlock, /enum: \[DISPONIBLE, APARTADO, EN_TRASLADO, EN_CONSULTA, NO_LOCALIZADO, EXTRAVIADO\]/,
  'EstadoOperativo must contain exactly the six canonical values');

const timelineBlock = contract.match(/    TimelinePage:\n([\s\S]*?)    BusinessReference:/)?.[1] ?? '';
includes('description: Opaque cursor returned by the preceding page.', 'Timeline cursor must be opaque');
assert.match(timelineBlock, /required: \[items, nextCursor\]/, 'Timeline must return items and nextCursor');
assert.doesNotMatch(timelineBlock, /\btotal\b/, 'Timeline must not expose total');

const movementBlock = contract.match(/    MovimientoExpedienteSummary:\n([\s\S]*?)    TimelinePage:/)?.[1] ?? '';
for (const field of ['movimientoId', 'movementType', 'originLocation', 'destinationLocation',
  'originCustodianRef', 'destinationCustodianRef', 'businessReferenceType',
  'businessReferenceId', 'occurredAt', 'recordedAt', 'actorRef', 'source', 'correlationId']) {
  assert.match(movementBlock, new RegExp(`\\b${field}\\b`), `Timeline movement is missing ${field}`);
}
assert.doesNotMatch(movementBlock, /\benum\b/, 'Movement and business reference types remain open strings');

for (const status of ['400', '401', '403', '404', '409']) {
  includes(`status: { const: ${status} }`, `Missing RFC7807 mapping for HTTP ${status}`);
}
for (const code of ['HTTP_VALIDATION_ERROR', 'AUTHENTICATION_REQUIRED', 'PERMISSION_DENIED',
  'INSUFFICIENT_ENABLING_SOURCE', 'EXPEDIENTE_NOT_FOUND', 'OPTIMISTIC_LOCK_CONFLICT',
  'REQUEST_INVALID_TRANSITION']) {
  includes(code, `Missing canonical error code ${code}`);
}
for (const fieldCode of ['REQUIRED', 'INVALID_FORMAT', 'INVALID_TYPE', 'OUT_OF_RANGE']) {
  includes(fieldCode, `Missing HTTP validation field code ${fieldCode}`);
}

excludes('updatedAt', 'updatedAt is not part of ExpedienteReadModel');
assert.doesNotMatch(contract, /^\s+unique(Item|s)?:/gmi, 'Expediente numero must not declare uniqueness');
excludes('/current-custody', 'Current custody endpoint is deferred');
excludes('/active-loan', 'Active loan endpoint is deferred');
excludes('/rearchive', 'Rearchive endpoint is deferred');
const capabilityBlock = contract.match(/    ExpedienteCapability:\n([\s\S]*?)    ExpedienteReadModel:/)?.[1] ?? '';
assert.doesNotMatch(capabilityBlock, /EXPEDIENT_VIEW/,
  'EXPEDIENT_VIEW is a permission, not a capability');
excludes('CROSS_TENANT', 'Cross-tenant existence must not be disclosed');

const requestSchemas = contract.match(/    DispatchExpedienteRequest:\n([\s\S]*?)    HttpFieldError:/)?.[1] ?? '';
for (const forbidden of ['tenant', 'actor', 'requestId', 'correlationId', 'occurredAt', 'acceptedAt', 'context']) {
  assert.doesNotMatch(requestSchemas, new RegExp(`\\b${forbidden}\\b`), `${forbidden} must not be accepted in command DTOs`);
}

console.log('OpenAPI Expediente Workspace contract validation OK');

// ---------------------------------------------------------------------------
// Agenda Preparation contract validation
// ---------------------------------------------------------------------------

const agendaPaths = [...contract.matchAll(/^  (\/agenda-imports[^:]*|\/agendas[^:]*):$/gm)].map((m) => m[1]);
assert.deepEqual(agendaPaths.sort(), [
  '/agenda-imports',
  '/agenda-imports/{importacionId}',
  '/agenda-imports/{importacionId}/incidents',
  '/agendas/{date}',
  '/agendas/{date}/preparation-items',
  '/agendas/{date}/preparation-items/print',
].sort(), 'Agenda Preparation must expose exactly the seven approved paths');

for (const op of ['importAgenda', 'listAgendaImports', 'getAgendaImportDetail',
  'getAgendaImportIncidents', 'getAgendaDaySummary', 'getAgendaPreparationList',
  'printAgendaPreparationList']) {
  includes(`operationId: ${op}`, `Missing Agenda operation ${op}`);
}

// Response shapes
includes('AgendaImportResponse', 'AgendaImportResponse schema is required');
includes('AgendaDayReadModel', 'AgendaDayReadModel schema is required');
includes('AgendaPreparationItem', 'AgendaPreparationItem is required');
includes('AgendaImportHistoryPage', 'AgendaImportHistoryPage is required');

// Pagination contracts
const prepListBlock = contract.match(/  \/agendas\/\{date\}\/preparation-items:\n([\s\S]*?)  \/agendas\/\{date\}\/preparation-items\/print:/)?.[1] ?? '';
assert.match(prepListBlock, /name: limit\n\s+required: true/, 'Preparation list limit must be required');
assert.match(prepListBlock, /name: order/, 'Preparation list order parameter is required');
assert.match(prepListBlock, /APPOINTMENT_TIME_ASC/, 'APPOINTMENT_TIME_ASC must appear in order enum');
assert.match(prepListBlock, /PATIENT_NAME_ASC/, 'PATIENT_NAME_ASC must appear in order enum');
assert.match(prepListBlock, /AgendaPreparationPage/, 'Preparation list must return AgendaPreparationPage');

// Multipart upload contract
const importPostBlock = contract.match(/  \/agenda-imports:\n([\s\S]*?)  \/agenda-imports\/\{importacionId\}:/)?.[1] ?? '';
assert.match(importPostBlock, /multipart\/form-data/, 'Import must use multipart/form-data');
assert.match(importPostBlock, /Idempotency-Key/, 'Idempotency-Key header must be documented');
assert.match(importPostBlock, /'201':/, 'Successful import returns 201');
assert.match(importPostBlock, /'413':/, 'Import must document 413 too large');
assert.match(importPostBlock, /'415':/, 'Import must document 415 unsupported');
assert.match(importPostBlock, /'422':/, 'Import must document 422 layout rejected');
assert.match(importPostBlock, /'409':/, 'Import must document 409 idempotency conflict');
assert.match(importPostBlock, /'504':/, 'Import must document 504 timeout');

// Privacy: no raw, fingerprint, filename, CURP in Agenda schemas
const agendaSchemaSection = contract.slice(contract.indexOf('    AgendaImportResponse:'));
for (const forbidden of ['fingerprint', 'filename', 'rawRow', 'raw_row', 'curp', 'turno', 'consultorio', 'destino']) {
  assert.ok(!agendaSchemaSection.includes(forbidden),
    `Agenda schemas must not expose ${forbidden}`);
}

// Metrics shape
const metricsBlock = contract.match(/    AgendaImportMetrics:\n([\s\S]*?)    AgendaImportSummary:/)?.[1] ?? '';
for (const field of ['receivedRecords', 'processed', 'added', 'updated', 'unchanged', 'restored',
  'pendingReview', 'rejected', 'duplicateFolio', 'withdrawnFromAgenda', 'incidents', 'errors']) {
  assert.match(metricsBlock, new RegExp(`\\b${field}\\b`), `Metrics missing field: ${field}`);
}

// RecordProcessingResult closed catalog
const resultBlock = contract.match(/    RegistroImportadoResult:\n([\s\S]*?)    AgendaImportDetail:/)?.[1] ?? '';
for (const result of ['ADDED', 'UPDATED', 'UNCHANGED', 'RESTORED', 'PENDING_REVIEW', 'REJECTED', 'DUPLICATE_FOLIO']) {
  assert.match(resultBlock, new RegExp(result), `RecordProcessingResult missing: ${result}`);
}

// ImportIncident closed catalog
const incidentEnum = contract.match(/    AgendaImportIncidentSummary:\n([\s\S]*?)    AgendaImportIncidentsPage:/)?.[1] ?? '';
for (const inc of ['PHYSICIAN_NOT_RESOLVED', 'PHYSICIAN_AMBIGUOUS', 'SERVICE_NOT_RESOLVED',
  'EXPEDIENT_NOT_RESOLVED', 'REQUIRED_DATA_MISSING', 'ROW_INCONSISTENT', 'DUPLICATE_FOLIO_IN_SNAPSHOT']) {
  assert.match(incidentEnum, new RegExp(inc), `ImportIncident catalog missing: ${inc}`);
}

// AgendaPreparationItem must not contain Turno/Consultorio/Destino
const prepItemBlock = contract.match(/    AgendaPreparationItem:\n([\s\S]*?)    AgendaPreparationPage:/)?.[1] ?? '';
for (const forbidden of ['turno', 'consultorio', 'destino', 'curp', 'rawRow']) {
  assert.ok(!prepItemBlock.toLowerCase().includes(forbidden),
    `AgendaPreparationItem must not contain ${forbidden}`);
}
assert.match(prepItemBlock, /tipoConsulta/, 'AgendaPreparationItem must have tipoConsulta');
assert.match(prepItemBlock, /FIRST_TIME/, 'tipoConsulta must include FIRST_TIME');
assert.match(prepItemBlock, /SUBSEQUENT/, 'tipoConsulta must include SUBSEQUENT');

// ImportOutcome closed catalog (no ALREADY_IMPORTED variants or extensions)
for (const outcome of ['IMPORTED', 'ALREADY_IMPORTED', 'RECONCILED']) {
  includes(outcome, `ImportOutcome must include: ${outcome}`);
}

// New error codes documented
for (const code of ['AGENDA_IMPORT_NOT_FOUND', 'AGENDA_NOT_FOUND', 'IDEMPOTENCY_KEY_REUSED',
  'AGENDA_UPLOAD_TOO_LARGE', 'AGENDA_ARTIFACT_UNSUPPORTED', 'AGENDA_LAYOUT_REJECTED',
  'AGENDA_IMPORT_FAILED', 'AGENDA_IMPORT_TIMEOUT']) {
  includes(code, `Missing Agenda error code: ${code}`);
}

// New HTTP status codes for Agenda (413, 415, 422, 500, 504)
for (const status of ['413', '415', '422', '500', '504']) {
  includes(`status: { const: ${status} }`, `Missing RFC7807 mapping for HTTP ${status}`);
}

// AGENDA_IMPORT, AGENDA_VIEW, AGENDA_INCIDENT_VIEW must be in Permission enum
for (const perm of ['AGENDA_IMPORT', 'AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW']) {
  includes(perm, `Permission enum must include ${perm}`);
}

console.log('OpenAPI Agenda Preparation contract validation OK');
