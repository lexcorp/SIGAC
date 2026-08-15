---
project: SIGAC
sdb_volume: "06 - Architecture & ADR"
version: "0.1.0"
status: "Draft for architecture validation"
date: "2026-08-13"
methodology:
  - Clean Architecture
  - Modular Monolith
  - C4 Model
  - Architecture Decision Records
  - Spec-Driven Development
---
# ARC-016 — Audit Architecture

Audit is separate from Domain Events and Movements.

Audit record candidate:
- audit_id;
- tenant_id;
- actor_id;
- action;
- resource_type/id;
- timestamp;
- request/correlation id;
- result;
- changed_fields summary;
- source (web/import/contingency);
- security context.

## Write model
Append-oriented. Application users cannot edit audit rows.

## Sensitive values
Do not log clinical data, tokens, secrets or full payloads unnecessarily.
