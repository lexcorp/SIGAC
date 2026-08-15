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
# ENG-040 — Testing Strategy

Layers:
1. domain unit
2. application use case
3. repository integration
4. API contract
5. authorization
6. tenant isolation
7. frontend component
8. end-to-end critical flows
9. security
10. performance
