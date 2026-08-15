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
# DAT-029 — Physical DDL

El paquete incluye:
- `sql/control/001_control_schema.sql`
- `sql/tenant/001_core_schema.sql`
- `sql/tenant/002_indexes.sql`
- `sql/tenant/003_outbox_audit.sql`
- `sql/demo/seed_demo.sql`

El DDL es starter schema de diseño, no migration production-ready.
