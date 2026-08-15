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
# DAT-017 — Index Strategy

High-value indexes:
- expedientes(expediente_numero)
- lower/normalized patient search column
- solicitudes(estado, fecha_requerida)
- solicitudes(expediente_id, estado)
- items_preparacion(jornada_id, estado)
- prestamos(estado, due_at)
- prestamos(expediente_id, estado)
- incidencias(estado, tipo)
- movimientos(expediente_id, occurred_at desc)
- audit_log(resource_type, resource_id, occurred_at desc)
- outbox(processed_at, available_at)

Indexes are validated against EXPLAIN during pilot.
