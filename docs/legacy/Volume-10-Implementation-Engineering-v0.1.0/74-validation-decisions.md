---
project: SIGAC
sdb_volume: "10 - Implementation & Engineering"
version: "0.1.0"
status: "Draft for engineering validation"
date: "2026-08-14"
architecture:
  style: "Modular Monolith + Clean Architecture"
  backend: "TypeScript + Node.js LTS + NestJS"
  frontend: "React + TypeScript + Vite"
  database: "PostgreSQL"
  api: "REST/OpenAPI"
  tenancy: "database-per-tenant"
---
# Engineering Validation Decisions

Confirm/adjust:

1. Monorepo.
2. Trunk-based-ish short feature branches + main releasable.
3. Conventional Commits.
4. Module ownership and Clean Architecture.
5. Repository ports rather than generic CRUD repositories.
6. Optimistic concurrency.
7. Outbox worker.
8. Generated typed client from OpenAPI.
9. Dedicated query/cache layer.
10. Real PostgreSQL in integration tests.
11. Mandatory tenant isolation tests.
12. CI security/contract gates.
13. Build once, promote same artifact.
14. Expand-contract migrations.
15. First vertical slice = Expediente lookup/workspace.
16. Codex operates only from approved specs.
