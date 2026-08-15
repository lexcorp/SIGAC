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
# ARC-023 — Availability & Contingency

SIGAC is operationally important but the hospital must retain a documented manual contingency workflow.

## System capabilities
- graceful failure pages;
- health checks;
- timeout/retry policy for external systems;
- import retries;
- reconciliation of records captured during contingency.

High availability topology is deployment-dependent and will be sized after pilot measurements.
