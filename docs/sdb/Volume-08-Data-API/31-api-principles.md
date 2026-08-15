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
# API-001 — API Principles

- REST/JSON.
- `/api/v1`.
- OpenAPI contract.
- authentication default.
- tenant resolved server-side.
- resource reads + command-oriented state transitions.
- safe retry semantics documented.
- RFC7807-style problem payload.
- timestamps UTC.
