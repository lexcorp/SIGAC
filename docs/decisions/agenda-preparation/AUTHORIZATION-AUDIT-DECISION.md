# Authorization and Audit Decision — Agenda Preparation

**Estado:** APPROVED

**Fecha:** 2026-08-20

**Scope:** `agenda-preparation v0.1.0-draft` / cierre de `AP-OQ-001`

## AUTH-AP-001 — ImportAttemptId

La frontera server-side genera un `ImportAttemptId` técnico, opaco y único después de
resolver `RequestContext`, pero antes de autorizar y antes de leer o interpretar el
archivo.

`ImportAttemptId` no forma parte de `RequestContext` y no equivale a `requestId`,
`correlationId`, fingerprint, filename, fecha de Agenda ni `ImportacionAgenda.id`. No
define la identidad lógica de Agenda ni de una importación persistida.

Un intento denegado se audita como
`AGENDA_IMPORT / AGENDA_IMPORT_ATTEMPT / ImportAttemptId / denied`.

## AUTH-AP-002 — Layout rejection

Un layout inválido es un resultado operacional de Agenda Preparation, no un
`AuditResult`. No produce `AuditEntry` con `success`, `denied`, `not-found`, `conflict`
o `invalid-transition`, y esta decisión no amplía el catálogo canónico. La conservación
estructural sanitizada queda regida posteriormente por RAW-AP-001..012; su taxonomía
funcional permanece en `AP-OQ-004`.

## AUTH-AP-003 — Audit success

`AGENDA_IMPORT/success` sólo se agrega cuando la importación queda aceptada/confirmada
conforme al contrato funcional que se apruebe. Una carga autorizada rechazada por layout
no produce audit success.

Que una importación aceptada sea idéntica, reconcilie cambios o produzca incidencias
parciales pertenece a su outcome operacional; no crea nuevos valores `AuditResult`.

## Permissions canónicas

| Permission | Autoridad de negocio |
|---|---|
| `AGENDA_IMPORT` | Importar o reimportar una Agenda; la reconciliación automática forma parte del mismo Use Case. |
| `AGENDA_VIEW` | Consultar importaciones, resultados, Agenda vigente y lista inicial de preparación. |
| `AGENDA_INCIDENT_VIEW` | Consultar incidencias de importación. |

No se crea `AGENDA_INCIDENT_RESOLVE`: la resolución manual dentro de SIGAC queda fuera
del alcance inicial. Tampoco se reutilizan permissions de Expediente Workspace.

## Permission × Action Matrix

| Operación | Permission | Capability |
|---|---|---|
| Importar/reimportar Agenda | `AGENDA_IMPORT` | No |
| Consultar importación y sus resultados | `AGENDA_VIEW` | No |
| Consultar Agenda vigente | `AGENDA_VIEW` | No |
| Consultar lista inicial de preparación | `AGENDA_VIEW` | No |
| Consultar incidencias de importación | `AGENDA_INCIDENT_VIEW` | No |

Agenda Preparation no introduce `capabilities[]`. Application decide autorización
exclusivamente desde `RequestContext.actor.permissions`; roles no sustituyen permissions.
Las fuentes identifican a Jefatura de Archivo y personal de Archivo designado como
actores operativos, pero esta decisión no añade roles ni asigna Role → Permission.

## Audit contract

| Operación | action | resourceType | resourceId | AuditResult aplicable |
|---|---|---|---|---|
| Intento de importación sin permission | `AGENDA_IMPORT` | `AGENDA_IMPORT_ATTEMPT` | `ImportAttemptId` | `denied` |
| Importación aceptada/confirmada | `AGENDA_IMPORT` | `AGENDA_IMPORT` | `ImportacionAgenda.id` | `success` |
| Consultar importación o resultados | `AGENDA_VIEW` | `AGENDA_IMPORT` | `ImportacionAgenda.id` solicitado | `success`, `denied`, `not-found` |
| Consultar Agenda vigente | `AGENDA_VIEW` | `AGENDA` | fecha canónica solicitada | `success`, `denied`, `not-found` |
| Consultar lista inicial | `AGENDA_PREPARATION_VIEW` | `AGENDA` | fecha canónica solicitada | `success`, `denied`, `not-found` |
| Consultar incidencias | `AGENDA_INCIDENT_VIEW` | `AGENDA_IMPORT` | `ImportacionAgenda.id` solicitado | `success`, `denied`, `not-found` |

Para queries, autorización precede al acceso a datos. Recurso ausente dentro del tenant
activo —incluido uno físicamente existente en otro tenant— usa `not-found` sin revelar
existencia cross-tenant. Una colección vacía de un recurso existente usa `success`.
`conflict` e `invalid-transition` no aplican a estas operaciones iniciales.

El `success` de importación se escribe sólo después de confirmar la operación conforme a
la futura semántica transaccional; esta decisión no resuelve AP-OQ-003/004.

## RequestContext, tenant y fail-closed

- Se reutiliza sin cambios el `RequestContext` canónico.
- Actor y tenant llegan prevalidados desde la frontera server-side.
- Ningún tenant procede de body, query, filename o archivo.
- Todas las operaciones, identidades y queries son tenant-scoped.
- No existe código público `CROSS_TENANT_*`.
- Permission ausente produce `PERMISSION_DENIED` antes de acceder al recurso.
- El acceso técnico al upload no concede `AGENDA_IMPORT`.

## Audit privacy

Se reutiliza `AuditWriter.append(AuditEntry, RequestContext)` sin cambiar su interface.
Ningún `AuditEntry` contiene nombre de paciente, contenido de filas, archivo, payload
raw, contacto, Expediente/paciente ni datos personales de Agenda, tampoco mediante
`changeSummary`.

Los únicos resource IDs aprobados son `ImportAttemptId`, `ImportacionAgenda.id` y la
fecha canónica de Agenda conforme a la tabla anterior.

## Estado de OQs

- `AP-OQ-001`: RESOLVED.
- `AP-OQ-002`: RESOLVED posteriormente por RAW-AP-001..012.
- `AP-OQ-003`: RESOLVED posteriormente por API-AP-001..014.
- `AP-OQ-004`: OPEN.

`implementation_ready` permanece `false`.

> Estado posterior: `AP-OQ-004` fue resuelto por RESULT-AP-001..014 en
> `IMPORT-RESULT-TAXONOMY-DECISION.md`. Esta sección conserva el estado histórico al
> aprobar AUTH-AP; la readiness vigente de la spec es `true`.
