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
# ARC-015 — Authorization

## Layers
1. Route authentication.
2. Coarse RBAC permission.
3. Tenant/hospital scope.
4. Domain/context policy.
5. Audit.

Example:
A user may have LOAN_OPEN, but opening a particular loan may still require an allowed request type and authorization path.

## Enforcement
Backend guards + application policy checks. Frontend permissions are convenience only.
