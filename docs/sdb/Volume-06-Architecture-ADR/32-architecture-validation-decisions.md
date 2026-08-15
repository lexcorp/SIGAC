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
# Architecture Validation Decisions

Confirm or adjust:

1. Modular monolith.
2. Clean Architecture.
3. TypeScript + Node.js LTS + NestJS.
4. React + TypeScript + Vite.
5. PostgreSQL.
6. REST + OpenAPI.
7. Control plane + database-per-tenant.
8. DEMO as isolated tenant/database.
9. OIDC as authentication standard.
10. Keycloak only as reference IdP when institutional IdP is unavailable.
11. RBAC + contextual authorization.
12. No Event Sourcing.
13. Transactional Outbox; no broker initially.
14. SIMEF file import first.
15. Containerized Linux deployment.
16. No Kubernetes requirement initially.
17. Audit != Domain Event != Movement.
18. UTC internally.
19. Server-side tenant resolution.
20. RLS only as defense-in-depth for shared data.
