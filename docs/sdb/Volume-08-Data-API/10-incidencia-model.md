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
# DAT-010 — Incidencia

- id
- expediente_id
- solicitud_id nullable
- prestamo_id nullable
- tipo
- severidad
- estado
- summary
- opened_by_ref
- assigned_to_ref
- opened_at
- resolved_at
- resolution_code
- resolution_notes

`incidencia_acciones`
- id
- incidencia_id
- action_type
- notes
- actor_ref
- created_at
