import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = new URL('../../openapi/sigac-v1.yaml', import.meta.url);
const contract = fs.readFileSync(file, 'utf8');

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
