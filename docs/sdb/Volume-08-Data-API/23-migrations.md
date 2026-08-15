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
# DAT-023 — Migrations

Migration categories:
- control DB;
- tenant DB;
- seed/reference data.

Tenant migration runner:
1. lock deployment migration job;
2. upgrade control;
3. enumerate active tenants;
4. migrate sequentially/batched;
5. record result;
6. stop/continue based on severity;
7. produce report.

No ad-hoc manual schema changes in production.
