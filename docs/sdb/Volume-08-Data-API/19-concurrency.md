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
# DAT-019 — Concurrency

Use optimistic concurrency with `row_version` on mutable aggregate roots.

Client sends expected version for commands that can conflict.

Conflict returns HTTP 409 with current version metadata.

Critical actions:
- transfer custody;
- open/close loan;
- resolve incident;
- state transition on request.
