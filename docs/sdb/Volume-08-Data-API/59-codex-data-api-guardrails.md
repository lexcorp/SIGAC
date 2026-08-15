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
# Codex Data/API Guardrails

Codex MUST:
- create migrations for schema changes;
- respect table ownership;
- use tenant-scoped connection;
- add indexes with query justification;
- update OpenAPI with API changes;
- add contract/integration tests;
- preserve optimistic concurrency;
- preserve audit and outbox semantics.

Codex MUST NOT:
- add tenant_id to business tables as replacement for DB isolation without ADR;
- join across tenant DBs;
- store clinical payloads;
- use audit table as movement history;
- bypass staging for SIMEF imports;
- introduce Elasticsearch/Redis as source of truth;
- make destructive migration without explicit approval.
