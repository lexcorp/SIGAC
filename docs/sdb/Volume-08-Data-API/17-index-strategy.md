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
- `expedientes_numero_normalizado_idx` btree no unique sobre
  `expedientes(expediente_numero_normalizado)`
- no se aprueba índice de búsqueda de paciente para Expediente Workspace v0.3.15;
- solicitudes(estado, fecha_requerida)
- solicitudes(expediente_id, estado)
- items_preparacion(jornada_id, estado)
- prestamos(estado, due_at)
- prestamos(expediente_id, estado)
- incidencias(estado, tipo)
- cualquier índice adicional de `movimientos_expediente` requiere aprobación posterior
- audit_log(resource_type, resource_id, occurred_at desc)
- outbox(processed_at, available_at)

Indexes are validated against EXPLAIN during pilot.
