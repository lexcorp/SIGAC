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
# DAT-007 — Solicitud

Campos:
- id
- expediente_id
- tipo
- origen
- fecha_requerida
- servicio_id
- consultorio_id
- solicitante_ref
- prioridad
- estado
- assigned_to_ref
- created_at
- updated_at
- cancelled_at
- cancellation_reason
- row_version

## Indexes
estado + fecha_requerida
expediente_id + estado
consultorio_id + fecha_requerida
