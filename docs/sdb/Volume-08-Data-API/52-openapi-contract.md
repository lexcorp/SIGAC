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
# API-022 — OpenAPI Contract

Included:
`openapi/sigac-v1.yaml`

It covers representative endpoints and schemas for:
- Expediente
- Solicitud
- Prestamo
- Incidencia
- AgendaImport
- ProblemDetails

It is a contract starter; Volume 09 UI and implementation will expand it.

Para Expediente Workspace v0.3.18, OpenAPI sólo publica operaciones respaldadas por un
Use Case Application canónico. `rowVersion` y `expectedRowVersion` usan `type: string`,
`pattern: '^[0-9]+$'`. La frontera documenta 401 para request no autenticada y 403 para
actor autenticado sin permission, además de los mappings RFC7807 canónicos.
