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
# ARC-010 — API Strategy

## Baseline
REST/JSON under `/api/v1`.
OpenAPI is the external contract.

## Conventions
- resource-oriented reads;
- action endpoints only when command semantics are clearer;
- idempotency key for imports and selected commands;
- RFC 7807-like problem details;
- cursor pagination for large histories;
- timestamps ISO-8601 UTC;
- tenant resolved before application use case.

## Examples
GET /api/v1/expedientes/{id}
POST /api/v1/solicitudes
POST /api/v1/solicitudes/{id}/assign
POST /api/v1/expedientes/{id}/custody-transfers
POST /api/v1/prestamos
POST /api/v1/devoluciones
