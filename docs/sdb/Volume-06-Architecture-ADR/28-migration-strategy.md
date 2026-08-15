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
# ARC-028 — Database Migration Strategy

All schema changes are versioned.

## Multi-tenant rule
Migration runner:
1. upgrades control DB;
2. enumerates tenants;
3. upgrades tenant DB one by one;
4. records migration state;
5. supports pause/retry;
6. emits audit/ops report.

Prefer expand-and-contract changes for zero/low downtime.
