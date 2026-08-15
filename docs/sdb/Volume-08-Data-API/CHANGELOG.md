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
# Changelog

## 0.1.0
- Physical/logical data model.
- Control-plane + tenant DB schemas.
- Audit/outbox/movement separation.
- SIMEF staging and reconciliation.
- Search/index/concurrency/migrations.
- REST/OpenAPI resource contracts.
- Idempotency/pagination/errors/versioning.
