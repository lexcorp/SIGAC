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
# ARC-022 — Backup & Recovery

## Per-tenant recoverability
Database-per-tenant enables independent recovery.

Baseline:
- scheduled PostgreSQL backups;
- encrypted backup storage;
- retention policy;
- restore tests;
- documented RPO/RTO;
- control DB backup;
- Keycloak backup per vendor guidance;
- configuration/secret recovery plan.

A backup that has never been restore-tested is not considered a recovery strategy.
