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
# DAT-021 — Retention Categories

- operational aggregate data: policy based on institutional need;
- movements: long-lived traceability candidate;
- audit: separate retention policy;
- outbox: purge after delivery retention window;
- staging: short technical retention;
- exports/temp: short-lived;
- backups: backup retention policy.

Exact periods require institutional validation.
