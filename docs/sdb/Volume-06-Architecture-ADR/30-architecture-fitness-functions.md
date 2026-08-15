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
# ARC-030 — Architecture Fitness Functions

Automatable checks candidates:
- domain packages cannot import NestJS/ORM.
- no cross-module infrastructure imports.
- every tenant-scoped repository requires TenantContext.
- API endpoints require auth unless explicitly public.
- migrations pass on empty and representative tenant DBs.
- tenant isolation integration tests pass.
- OpenAPI diff checked in CI.
- no secrets in repository.
- dependency vulnerabilities policy enforced.
- audit events emitted for critical commands.
