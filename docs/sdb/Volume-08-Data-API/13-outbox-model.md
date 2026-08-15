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
# DAT-013 — Transactional Outbox

- id
- event_type
- aggregate_type
- aggregate_id
- payload jsonb
- occurred_at
- available_at
- attempts
- processed_at
- last_error
- correlation_id

Index:
processed_at null + available_at

Worker debe procesar idempotentemente.
