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
# API-023 — Integration Contract

External systems should integrate through:
- file import;
- authenticated REST;
- future event/webhook adapter if approved.

Every integration has:
- source identity;
- tenant mapping;
- idempotency;
- schema version;
- correlation id;
- retry policy;
- audit.
