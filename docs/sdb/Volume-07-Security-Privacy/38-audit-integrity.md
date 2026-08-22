---
project: SIGAC
sdb_volume: "07 - Security & Privacy"
version: "0.1.0"
status: "Draft for security/privacy validation"
date: "2026-08-13"
baseline:
  - OWASP ASVS 5.0
  - OWASP Top 10 2025
  - NIST SP 800-207
  - LGPDPPSO vigente
  - NOM-004-SSA3-2012
---
# SEC-038 — Audit Integrity

- append-oriented write path;
- application role cannot update/delete audit rows;
- retention policy;
- timestamps server-side;
- actor and tenant mandatory;
- correlation ID;
- privileged export controlled;
- periodic integrity/reconciliation checks candidate.

Cryptographic chaining is optional and requires separate ADR; not required by default.

## Enforcement para Expediente Workspace

Los Use Cases escriben mediante el puerto de Application `AuditWriter`; los controllers
no son propietarios del audit. Application entrega un `AuditEntry` semántico y el
`RequestContext` canónico. El writer crea el `AuditRecord` completo con `actorRef` y
tenant desde el contexto, `requestId`, `correlationId` y `source` desde el contexto y
`occurredAt` establecido al hacer append. El contrato sólo permite append.

`requestId` identifica una ejecución concreta y `correlationId` un flujo lógico; no son
intercambiables. El contexto se construye y valida en la frontera server-side, nunca
desde body/query arbitrarios.

Para `GetExpediente`, la acción canónica es `EXPEDIENTE_VIEW`, el recurso es
`EXPEDIENTE` y los resultados son exactamente `success`, `denied`, `not-found`.
Los intentos fallidos también se registran sin datos C3.

Para `GetExpedienteTimeline`, la acción es `EXPEDIENTE_TIMELINE_VIEW`, el recurso es
`EXPEDIENTE` y el resource ID es `expedienteId`. Autorización precede a toda query;
ausencia tenant-scoped se registra `not-found`. Página vacía o no vacía de un Expediente
existente se registra `success`. El audit no crea ni se mezcla con movimientos.

Para `SearchExpedientesByNumero`, la acción es `EXPEDIENTE_SEARCH`, el recurso es
`EXPEDIENTE` y resourceId es el `ExpedienteNumero` normalizado. Una búsqueda válida con
0..N resultados usa `success`; cero resultados no usa `not-found`. El changeSummary no
registra nombres, CURP, número ISSSTE, IDs/cantidad de resultados ni otros datos C3.

Para Dispatch, acción `EXPEDIENTE_DISPATCH`, recurso `EXPEDIENTE`, ID expedienteId.
Success es atómico con aggregate/movimiento; denied/not-found se escriben sin mutación.
Optimistic lock mismatch se registra como `conflict`, fuera de la UoW mutante y después
de su rollback completo. No persiste aggregate, Movimiento ni audit success.
Una transición inválida se registra como `invalid-transition` fuera de la UoW mutante y
después del rollback. Tampoco persiste aggregate, Movimiento ni audit success.
`conflict` no se reutiliza para transiciones inválidas.

Para AcceptCustody se usa `CUSTODY_ACCEPTED/EXPEDIENTE/expedienteId`. Success pertenece
a la UoW mutante; denied/not-found/conflict/invalid-transition se registran fuera.

`GetExpedienteAudit` expone sólo auditId, action, result, actorRef, occurredAt, source,
requestId y correlationId. Filtra `resource_type=EXPEDIENTE` y resource_id tenant-scoped;
no expone changeSummary, securityContext ni metadata interna. Requiere
`EXPEDIENT_AUDIT_VIEW` y nunca mezcla sus filas con MovimientoExpediente.

## Agenda Preparation

| Operación | Action / resource / result |
|---|---|
| Import denegado | `AGENDA_IMPORT / AGENDA_IMPORT_ATTEMPT / ImportAttemptId / denied` |
| Import aceptado | `AGENDA_IMPORT / AGENDA_IMPORT / ImportacionAgenda.id / success` |
| Consultar importación/resultados | `AGENDA_VIEW / AGENDA_IMPORT / importacionId / success|denied|not-found` |
| Consultar Agenda | `AGENDA_VIEW / AGENDA / fechaAgenda / success|denied|not-found` |
| Consultar preparación | `AGENDA_PREPARATION_VIEW / AGENDA / fechaAgenda / success|denied|not-found` |
| Consultar incidencias | `AGENDA_INCIDENT_VIEW / AGENDA_IMPORT / importacionId / success|denied|not-found` |

Layout rechazado no genera AuditEntry. Outcome operacional, outcome por fila,
AuditResult y futuro HTTP status son conceptos distintos. Audit no incluye archivo, raw,
filas ni datos personales de Agenda.

RESULT-AP-014 confirma que resultados/incidencias de fila no generan AuditEntry. Los
cuatro niveles funcionales no amplían ni sustituyen AuditResult.

El ownership de `AuditWriter`, `AuditEntry` y `AuditResult` es Security/Audit Application
compartido en `@sigac/audit`. Archive Operations y Agenda Preparation consumen ese
contrato sin duplicarlo; Agenda Preparation no importa Archive Operations para auditar.
La extracción física es un prerequisito técnico y conserva exactamente los cinco
`AuditResult`, la shape de AuditEntry, PostgresAuditWriter y audit_log.
