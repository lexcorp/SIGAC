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
# DAT-008 — Preparation

`jornadas_preparacion`
- id
- fecha
- turno
- estado
- source_agenda_import_id
- created_at
- closed_at

`items_preparacion`
- id
- jornada_id
- solicitud_id
- expediente_id
- especialidad_id
- consultorio_id
- hora_cita
- estado
- assigned_to_ref
- located_at
- prepared_at
- late_added boolean

Unique candidate:
(jornada_id, solicitud_id)
