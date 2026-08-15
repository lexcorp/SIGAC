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
