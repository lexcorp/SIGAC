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
# API-007 — Pagination

Default:
cursor pagination for histories/audit/movements.

Response:
- items
- nextCursor
- hasMore

Offset pagination acceptable for small reference catalogs.

Server enforces max page size.

Para Expediente Timeline el contrato específico es `{ items, nextCursor }`; no exige
`hasMore` ni `total`. El cursor opaco representa `occurredAt + movimientoId`. El orden es
`occurredAt DESC, movimientoId DESC`. No hay un máximo numérico canónico aprobado, por
lo que este slice no inventa uno.
