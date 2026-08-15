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
# DAT-006 — Expediente

Campos candidatos:
- id UUID
- expediente_numero varchar
- paciente_ref_id UUID/null
- paciente_nombre_busqueda varchar
- estado_operativo varchar
- ubicacion_actual_id UUID/null
- custodio_tipo varchar/null
- custodio_ref varchar/null
- last_movement_id UUID/null
- created_at timestamptz
- updated_at timestamptz
- row_version bigint

## Constraints
- expediente_numero único por tenant/hospital.
- estado_operativo enum/check.
- row_version para optimistic concurrency.
