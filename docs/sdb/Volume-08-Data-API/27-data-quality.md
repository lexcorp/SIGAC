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
# DAT-027 — Data Quality

Quality rules:
- expediente identifier completeness;
- duplicate detection;
- invalid location detection;
- orphan request prevention;
- agenda row validation;
- stale custody detection;
- inconsistent state reconciliation reports.

Do not silently “fix” source data without preserving evidence.
