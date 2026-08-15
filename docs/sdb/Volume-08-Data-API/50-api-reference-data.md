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
# API-020 — Reference Data

GET /ubicaciones
GET /servicios
GET /consultorios
GET /especialidades

Admin mutations:
POST/PATCH only with configuration permission and audit.

Para Expediente Workspace se define `ListUbicaciones`, con input
`{ context: RequestContext }`, y `UbicacionesQueryPort.findAll(context.tenant)`. Requiere
`LOCATION_VIEW` antes del query y retorna exclusivamente `{id,codigo,descripcion}`.

GET `/api/v1/ubicaciones` responde `{ items: readonly UbicacionOption[] }`, sin total,
cursor ni paginación. Vacío es 200 `{ "items": [] }`; no autenticado es 401
`AUTHENTICATION_REQUIRED`; sin permission es 403 `PERMISSION_DENIED`; no hay 404 por
catálogo vacío. El controller no accede directamente a Drizzle. La política vigente no
exige una acción de audit para esta lectura de reference data.

`LOCATION-PERMISSION-GAP` queda CLOSED. `LOCATION_VIEW` no se sustituye por
`EXPEDIENT_VIEW` ni `ADMIN_CONFIGURE`.
