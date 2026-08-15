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
# ARC-021 — Observability

## Signals
- structured application logs;
- metrics;
- traces;
- health/readiness checks;
- security/audit events.

## Required correlations
request_id, trace_id, tenant_id, actor_id where safe.

## Operations
Expose health/metrics suitable for integration with hospital monitoring such as Checkmk.

Never place patient clinical content in observability payloads.
