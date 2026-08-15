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
# API-026 — Compatibility Policy

Frontend and API may deploy together initially, but API compatibility is still documented.

Deprecation:
- mark deprecated in OpenAPI;
- communicate replacement;
- retain for agreed window;
- remove only in new major API or coordinated release.
