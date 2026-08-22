# OS-017 — Definition of Ready

Approved spec, permissions, AC, ADR, API/UI deps, blocking OQs resolved.

Para Expediente Workspace T-04, AUTH-GAP-001..013 están cerrados por
`docs/decisions/expediente-workspace/AUTHORIZATION-DECISION.md`.
OQ-EW-003 está RESOLVED en v0.3.21 mediante `EXPEDIENT_AUDIT_VIEW`; el tab Auditoría
permanece fuera de las capabilities operativas de T-04.

Para T-11, HTTP-EW-001, API-BIGINT-001 y API-EW-021 cierran los contratos de resolver
HTTP autenticado, tenant membership, tracing, bigint decimal en JSON, scope limitado a
Use Cases existentes y distinción 401/403. La selección concreta de claims OIDC no se
inventa ni bloquea este contrato de frontera.

API-EW-024/025 definen 204 sin body para ambos commands; API-EW-026 cierra RFC7807 de
validación 400; API-EW-030 define el módulo configurable y ownership de composition.
T-11 puede probarse con providers explícitos y no requiere fakes en `AppModule`.

Para T-05, `READ-EW-001..013`, `AUTH-EW-006/007`, `CTX-EW-001..004`,
`AUD-EW-001..006` y `ERR-EW-001..004` definen
composición server-side, query ports de proyección, colección de fuentes habilitantes y
RequestContext/audit append-only. `OQ-EW-DESIGN-004` está RESOLVED por
READ-MODEL-COMPOSITION-DECISION. T-05 no tiene gaps bloqueantes conocidos.

Para T-06, `TL-EW-001..017` define ownership, query port, summary, cursor pagination,
tenant, autorización y audit. `OQ-EW-DESIGN-003` y `OQ-DOM-001` están RESOLVED.
`OQ-EW-010` permanece abierta y no bloquea porque T-06 no decide retención.

T-07 está ready: DSP-GAP-001/002 están cerrados. intendedCustodian type/reference son
obligatorios y no vacíos; AuditResult incorpora conflict y su append ocurre después del
rollback fuera de la UoW mutante.
DSP-EW-014..016 cierran la construcción de Custodia: Dispatch recibe type/reference
explícitos; service/location/acceptedAt quedan null y nada se deriva de destination.
El gap temporal también está cerrado por DOM-EVENT-001: Application pasa
operationOccurredAt al aggregate y evento/movimiento comparten exactamente el instante.
El audit de estado incompatible está cerrado por AUD-EW-010..013:
`REQUEST_INVALID_TRANSITION` usa `invalid-transition`; `conflict` queda reservado al
optimistic lock mismatch. T-07 no tiene gaps bloqueantes conocidos.

T-08 está ready: CST-GAP-001/002 están cerrados. businessReference procede del input y
audit usa `CUSTODY_ACCEPTED/EXPEDIENTE/expedienteId` con los cinco resultados canónicos.

T-10 está ready mediante POSTGRES-PHYSICAL-MODEL-DECISION DB-EW-001..014: nombres
físicos, DDL, nullability, índices, CHECKs, FKs, tenant/HospitalId y mapping VO ↔ DB
quedan definidos. OQ-DAT-004 está RESOLVED; no quedan gaps bloqueantes conocidos para
la migración.

T-09 tiene definidos routing, transaction binding, ownership de audit_log, UoW y
operationOccurredAt mediante TX-EW-001..012. AUD-DB-EW-001..013 cierra AUD-DB-GAP con
DDL, mapping y migration ownership completos. T-09 está ready y no tiene gaps
bloqueantes conocidos.

Para la búsqueda, SEARCH-EW-001..010 define Use Case, summary 0..N, Repository
tenant-scoped, `EXPEDIENT_VIEW`, audit, endpoint, response `{items}`, validación y UX
0/1/N. La task T-12A debe implementar en orden Application → API → OpenAPI antes de
reactivar T-13/T-15. No quedan gaps documentales bloqueantes para esa implementación.

Para pre-T-22, OQ-EW-003 queda RESOLVED por
EXPEDIENT-AUDIT-AND-COMMAND-UX-DECISION: `EXPEDIENT_AUDIT_VIEW`,
GetExpedienteAudit/ExpedienteAuditQueryPort/API sanitizada y los dos diálogos quedan
definidos. v0.3.22 aprueba `LOCATION_VIEW` para `ListUbicaciones`, separada de
`EXPEDIENT_VIEW`, `EXPEDIENT_AUDIT_VIEW` y `ADMIN_CONFIGURE`.
LOCATION-PERMISSION-GAP queda CLOSED; T-21A/T-22 no conservan bloqueos conocidos.

v0.3.23 fija Audit `occurredAt DESC, auditId DESC`, cursor conceptual
`occurredAt + auditId`, y GET `/api/v1/session` como fuente server-derived de
permissions para frontend. Los dos bloqueos restantes de T-21A quedan cerrados.

## Agenda Preparation v0.1.1

`AP-OQ-001` está RESOLVED mediante
`docs/decisions/agenda-preparation/AUTHORIZATION-AUDIT-DECISION.md`: permissions,
ausencia de capabilities, `ImportAttemptId` preautorización y audit sanitizado quedan
definidos. Layout rechazado no amplía AuditResult ni genera AuditEntry.
En ese cierre, `AP-OQ-002..004` permanecían OPEN. RAW-AP-001..012 resuelve después
AP-OQ-002; `implementation_ready` sigue false por AP-OQ-003/004.

`AP-OQ-002` queda RESOLVED mediante
`docs/decisions/agenda-preparation/RAW-DATA-RETENTION-DECISION.md`: raw transitorio,
allow-list durable, retención diferenciada/configurable, protección institucional,
disposición y ausencia de acceso humano. En ese cierre AP-OQ-003/004 seguían OPEN;
API-AP-001..014 resuelve posteriormente AP-OQ-003.

`AP-OQ-003` queda RESOLVED mediante
`docs/decisions/agenda-preparation/IMPORT-API-DECISION.md`: input stream, multipart
`.xls`, límites/timeouts configurables, síncrono, UoW, Idempotency-Key, 201/Location,
queries, cursor y errors quedan definidos. `AP-OQ-004` continúa OPEN y
`implementation_ready` permanece false.

`AP-OQ-004` queda RESOLVED mediante
`docs/decisions/agenda-preparation/IMPORT-RESULT-TAXONOMY-DECISION.md`. Con AP-OQ-001..004
resueltos y AP-OQ-005/006 fuera del slice inicial, Agenda Preparation queda
`Approved for Implementation`; `implementation_ready: true`.

v0.1.1 resuelve UX-GAP-004/005 mediante `ListAgendaImports`, historial cursor-based y
`AgendaDayReadModel`. Permanecen tres UX gaps no bloqueantes: preview previo de
validación, filtros/búsqueda y retry técnico/Idempotency-Key. `implementation_ready`
continúa true.

v0.1.2 aprueba VO-AP-001..008 mediante
`docs/decisions/agenda-preparation/DOMAIN-VALUE-OBJECTS-DECISION.md`. El bloqueo
documental de T-01 queda resuelto; T-01 puede implementarse sin inventar formatos,
normalización, igualdad o provenance. `implementation_ready` continúa true.

v0.1.3 aprueba VO-AP-009/010: los cinco DomainError codes quedan cerrados sin mapping
HTTP ni cambios a ApplicationError/AuditResult/resultados. No queda gap material conocido
para implementar T-01; la implementación no inicia en esta decisión.

v0.1.4 aprueba IMP-AP-001..014 mediante
`docs/decisions/agenda-preparation/IMPORTACION-AGENDA-DOMAIN-DECISION.md`: IDs externos,
ownership temporal, lifecycle, registros/incidencias, evidencia allow-listed, métricas
derivadas, errores e idempotencia interna quedan cerrados. `ImportArtifactMetadata` queda
fuera de Domain y layout fail-closed se difiere a Application/parser. T-02 queda ready;
`implementation_ready` continúa true.

v0.1.5 corrige exclusivamente namespaces de invariantes: `INV-AP-001..012` conserva las
invariantes globales canónicas de la spec; `INV-IMP-AP-001..006` identifica las
invariantes verificables de ImportacionAgenda/T-02 y traza hacia `IMP-AP-001..014` sin
renombrar esas decisiones. La referencia de T-03 a `INV-AP-001..005` vuelve a ser
inequívoca; `implementation_ready` continúa true.

v0.1.6 aprueba AGD-AP-001..009 mediante
`docs/decisions/agenda-preparation/AGENDA-CITA-DOMAIN-DECISION.md`: identidad/boundary de
Agenda, shape/lifecycle de Cita, HoraCita, MedicoReferencia, ExpedienteReferencia,
comparación, reconciliación atómica, historia lógica, temporalidad y errores quedan
cerrados. Los Domain Events candidatos se difieren explícitamente; T-03 queda ready y no
inicia en esta actualización. `implementation_ready` continúa true.

v0.1.7 aprueba PORT-AP-001..010 y PREP-AP-001..004 mediante
`APPLICATION-PORTS-AND-PREPARATION-READ-DECISION.md`. Cierra ownership compartido de
Audit, persistencia separada de fingerprint y agrupación/orden/impresión de la lista.
T-04A extrae el contrato Audit a `@sigac/audit` sin cambios semánticos antes de T-05.
No quedan gaps documentales conocidos para T-05; `implementation_ready` continúa true.
