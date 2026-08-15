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
# DAT-011 — MovimientoExpediente

Append-oriented.

- id
- expediente_id
- movement_type
- origin_location_id nullable
- destination_location_id nullable
- origin_custodian_ref nullable
- destination_custodian_ref nullable
- business_reference_type
- business_reference_id nullable
- occurred_at
- recorded_at
- actor_ref
- source
- correlation_id

## Purpose
Reconstruir trayectoria física/operativa.

No se usa para:
- login;
- configuración;
- cambios de permisos;
- audit técnico general.
