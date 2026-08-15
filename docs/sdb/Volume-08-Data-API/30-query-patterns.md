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
posee `ActiveLoanQueryPort`, `ActiveRequestQueryPort` y `OpenIncidentsQueryPort`; todos
reciben `ExpedienteId` y `TenantContext` y retornan summaries, nunca aggregates.

- Solicitud activa: `0..1`, ausencia `null`.
- Préstamo activo: `0..1`, ausencia `null`.
- Incidencias abiertas: `0..N`, ausencia `[]`.

Los contratos exactos están en READ-MODEL-COMPOSITION-DECISION READ-EW-003..006.
