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
# Technical Reference Notes — 2026-08-13

External technical references reviewed for this architecture:

- Node.js official release pages: use a maintained LTS release for production rather than a Current release.
- NestJS official documentation: module-based application structure and dependency injection support the modular monolith adapter/application design.
- PostgreSQL official documentation: Row-Level Security can restrict rows by roles/commands and is suitable as defense-in-depth on shared tables.
- Keycloak official documentation: realms isolate users/credentials/roles/groups; Keycloak supports standard identity administration and OIDC-based application integration.

Exact product versions are intentionally not architectural invariants. Version pinning belongs in the implementation/dependency policy.
