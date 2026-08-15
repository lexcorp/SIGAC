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
# ARC-013 — DEMO Isolation

DEMO is a real tenant from the platform perspective with:
- own tenant id;
- own database;
- synthetic seed;
- own user assignments;
- reset job;
- visible DEMO banner;
- no connectivity to production tenant data.

## Reset
Versioned seed → drop/recreate or transactional reset → migrate → seed → smoke test.

## Forbidden
- copying real patient data into DEMO;
- shared business tables with production;
- production backups restored into DEMO without sanitization.
