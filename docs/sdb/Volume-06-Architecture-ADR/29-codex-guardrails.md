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
# ARC-029 — AI / Codex Architecture Guardrails

Codex MUST:
- respect module boundaries;
- put domain logic in domain/application, not controllers;
- use repository ports;
- propagate TenantContext;
- add tests for invariants;
- update OpenAPI/specs when contract changes;
- generate migrations through approved mechanism;
- preserve audit requirements.

Codex MUST NOT:
- introduce microservices;
- introduce Event Sourcing;
- add a message broker;
- change tenant isolation model;
- replace OIDC;
- bypass application authorization;
- query another tenant database;
- add clinical data fields;
- use raw SQL without approved repository/adapter conventions;
- make an ADR Accepted by itself.
