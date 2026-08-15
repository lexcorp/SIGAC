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
# DAT-020 — Transactions

One application command = one tenant DB transaction when possible.

Inside transaction:
- load aggregate;
- validate;
- write aggregate state;
- append movement if relevant;
- append outbox event;
- append audit metadata through coordinated mechanism.

Avoid distributed transactions across tenant databases/control plane.
