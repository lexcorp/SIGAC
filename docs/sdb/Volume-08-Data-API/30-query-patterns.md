---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.1.0"
status: "Draft for data/API validation"
date: "2026-08-13"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# DAT-030 — Query Patterns

Optimized queries:
- current expediente status;
- expediente timeline;
- pending preparation;
- overdue loans;
- open incidents;
- agenda import errors;
- requests by date/service;
- returned pending rearchive.

Avoid giant “everything joins everything” screens. Use purpose-built read models.

## Expediente Workspace

El read model del Workspace se compone server-side. Application de Expediente Workspace
posee `ActiveLoanQueryPort`, `ActiveRequestQueryPort`, `OpenIncidentsQueryPort` y
`ExitEnablingSourceQueryPort`; todos reciben `ExpedienteId` y `TenantContext` y retornan
proyecciones, nunca aggregates.

- Solicitud activa: `0..1`, ausencia `null`.
- Préstamo activo: `0..1`, ausencia `null`.
- Incidencias abiertas: `0..N`, ausencia `[]`.
- Fuentes habilitantes disponibles: `0..N`, ausencia `[]`; elementos `{ tipo, validada }`.

`ExitEnablingSourceQueryPort.findAvailableByExpediente(ExpedienteId, TenantContext)` no
expone evidencia completa. El provider determina `validada`; no se especifica aquí su
adapter concreto.

Los contratos exactos están en READ-MODEL-COMPOSITION-DECISION READ-EW-003..012.

### Timeline de Expediente

`ExpedienteTimelineQueryPort.findByExpediente(ExpedienteId, TimelinePagination,
TenantContext)` pertenece a Application de Archive Operations. Usa cursor opaco
`occurredAt + movimientoId`, orden `occurredAt DESC, movimientoId DESC` y devuelve
`TimelinePage { items, nextCursor }`. Ausencia: `[]/null`; no retorna `total` ni agrega
filas de audit.
