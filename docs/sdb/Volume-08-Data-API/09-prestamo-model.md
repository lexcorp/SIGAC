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
# DAT-009 — Prestamo

- id
- expediente_id
- solicitud_id nullable
- tipo
- finalidad
- solicitante_ref
- custodio_ref
- destino_tipo
- destino_ref
- opened_at
- due_at
- returned_at
- closed_at
- estado
- row_version

`prestamo_renovaciones`
- id
- prestamo_id
- previous_due_at
- new_due_at
- reason
- authorized_by_ref
- created_at
