# Agenda Preparation — authorization/audit boundary

El contrato HTTP estuvo abierto durante AUTH-AP-001..003. API-AP-001..014 lo resuelve
posteriormente con los contratos descritos abajo.

La futura frontera server-side resolverá RequestContext y generará un `ImportAttemptId`
opaco antes de invocar Application, autorizar o leer el archivo. El ID no forma parte de
RequestContext ni identifica Agenda o ImportacionAgenda persistida.

Permissions: `AGENDA_IMPORT`, `AGENDA_VIEW`, `AGENDA_INCIDENT_VIEW`. No existen
capabilities contextuales. Tenant sólo procede del RequestContext resuelto.

Audit usa `AGENDA_IMPORT`, `AGENDA_VIEW`, `AGENDA_PREPARATION_VIEW` y
`AGENDA_INCIDENT_VIEW`, con resources `AGENDA_IMPORT_ATTEMPT`, `AGENDA_IMPORT` y
`AGENDA`. Layout rechazado no se representa mediante AuditResult ni genera AuditEntry.

## Contrato API — API-AP-001..014

- POST `/api/v1/agenda-imports`: multipart, un `file` `.xls`, Idempotency-Key requerido.
- RequestContext/ImportAttemptId server-side; fecha interpretada del contenido.
- Límite/timeout configurables, streaming fail-fast, ejecución síncrona.
- 201 + Location + summary para IMPORTED, ALREADY_IMPORTED o RECONCILED.
- Layout incompatible: `AGENDA_LAYOUT_REJECTED`/422, sin ImportacionAgenda.
- UoW ALL OR NOTHING para ImportacionAgenda, Agenda/Citas, resultados, métricas y audit.
- GET `/agenda-imports/{id}`, `/results`, `/incidents`.
- GET `/agenda-imports` con `agendaDate?`, `cursor?` y `limit` requerido: página
  `{items,nextCursor}`, orden `importedAt DESC, importacionId DESC` y cursor conceptual
  opaco `importedAt + importacionId`. Cada item contiene sólo importacionId, agendaDate,
  importedAt, outcome y metrics; sin total, hasMore, raw, filename, fingerprint,
  actorRef o datos personales. Empty es 200.
- GET `/agendas/{date}`, `/agendas/{date}/preparation-items`.
- Colecciones usan cursor `{items,nextCursor}`, sin total/hasMore.

OpenAPI se actualizará en la task futura; AP-OQ-003 no modifica el contrato publicado.

## Result taxonomy — RESULT-AP-001..014

ImportOutcome: `IMPORTED|ALREADY_IMPORTED|RECONCILED`. RecordProcessingResult:
`ADDED|UPDATED|UNCHANGED|RESTORED|PENDING_REVIEW|REJECTED|DUPLICATE_FOLIO`.
ImportIncident: `PHYSICIAN_NOT_RESOLVED|PHYSICIAN_AMBIGUOUS|SERVICE_NOT_RESOLVED|
EXPEDIENT_NOT_RESOLVED|REQUIRED_DATA_MISSING|ROW_INCONSISTENT|
DUPLICATE_FOLIO_IN_SNAPSHOT`. Read models/métricas están en la decisión; sin raw ni
nuevos AuditResult. AP-OQ-004 no modifica OpenAPI todavía.

## AgendaDayReadModel v0.1.1

GET `/api/v1/agendas/{date}` devuelve, con `AGENDA_VIEW`: agendaDate,
latestImportacionId, latestImportedAt, latestOutcome, activeAppointments, physicians,
services e incidentCount. ActiveAppointments excluye retiradas; physicians cuenta
números de empleado distintos; services cuenta Servicio/Especialidad distintos;
incidentCount cuenta incidencias vigentes sin presumir lifecycle de resolución.

Ausencia tenant-scoped usa `AGENDA_NOT_FOUND`/404. No incluye Turno, Consultorio,
Destino, raw, fingerprint, filename, actorRef o lista de Citas. Esta actualización
conceptual no modifica todavía OpenAPI.
