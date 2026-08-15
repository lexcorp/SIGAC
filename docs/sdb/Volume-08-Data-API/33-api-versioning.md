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
# API-003 — Versioning

Major version in path: `/api/v1`.

Backward-compatible changes:
- optional response fields;
- optional request fields with safe defaults;
- new endpoints.

Breaking:
- field removal/rename;
- semantic changes;
- required new field;
- incompatible enum removal.

Breaking changes require `/v2` or controlled migration.
