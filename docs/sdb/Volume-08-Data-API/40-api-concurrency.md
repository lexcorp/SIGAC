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
# API-010 — Concurrency

Mutable resources expose version/ETag candidate.

Commands may require `If-Match`.

Stale version → `OPTIMISTIC_LOCK_CONFLICT`, HTTP 409 para Expediente Workspace.

La convención global 409/412 para otros slices permanece abierta; no modifica la
decisión explícita de este vertical slice.

El code de Dispatch sigue siendo `OPTIMISTIC_LOCK_CONFLICT`/409 y su resultado de audit
es `conflict`. El append ocurre fuera de la UoW mutante después del rollback; no se
persiste Movimiento ni cambio del aggregate.

En Application las versiones son `bigint`. JSON/OpenAPI representa `rowVersion` y
`expectedRowVersion` como string decimal con patrón `^[0-9]+$`; la frontera convierte
en ambos sentidos sin pasar por JavaScript `number`.
