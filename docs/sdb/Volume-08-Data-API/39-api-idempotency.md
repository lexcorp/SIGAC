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
# API-009 — Idempotency

Use `Idempotency-Key` for:
- agenda import;
- open loan candidate;
- custody transfer candidate;
- external integration commands.

Server stores key + request fingerprint + response for bounded window.

Same key + different payload → 409.
