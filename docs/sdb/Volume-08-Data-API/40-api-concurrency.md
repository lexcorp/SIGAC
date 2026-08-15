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
# API-010 — Concurrency

Mutable resources expose version/ETag candidate.

Commands may require `If-Match`.

Stale version → 409/412 according to chosen API convention.

Decision to standardize exact HTTP code remains open.
