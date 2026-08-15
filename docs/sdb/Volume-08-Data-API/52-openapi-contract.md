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

Para Expediente Workspace v0.3.20, OpenAPI sólo publica operaciones respaldadas por un
Use Case Application canónico. `rowVersion` y `expectedRowVersion` usan `type: string`,
`pattern: '^[0-9]+$'`. La frontera documenta 401 para request no autenticada y 403 para
actor autenticado sin permission, además de los mappings RFC7807 canónicos.

Los comandos Dispatch/AcceptCustody documentan 204 sin content. HTTP validation usa
400 `HTTP_VALIDATION_ERROR` y field codes cerrados. El módulo API configurable puede
probarse con providers explícitos aunque su montaje productivo se difiera hasta disponer
de dependencias reales; esto no cambia el contrato OpenAPI.

La extensión posterior a T-12 documenta `GET /api/v1/expedientes?numero={numero}` sólo
después de implementar `SearchExpedientesByNumero`. `numero` es requerido y la respuesta
es `{ items: ExpedienteSearchItem[] }`, cardinalidad 0..N, sin `total` ni paginación.
El OpenAPI no marca `expedienteNumero` como unique y conserva 400/403 canónicos.
