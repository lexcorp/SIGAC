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
# DAT-022 — Soft Delete Policy

No universal `deleted_at`.

Use domain lifecycle:
- solicitud Cancelada;
- incidente Resuelta;
- préstamo Cerrado;
- ubicación Inactiva.

Hard deletion only for technical/transient data where retention allows.
Soft-delete is not a substitute for history/audit.
