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
# ENG-019 — Error Taxonomy

Domain:
- invariant violation;
- invalid transition;
- not available;
- conflict.

Application:
- authorization denied;
- resource not found;
- concurrency conflict.

Infrastructure:
- DB unavailable;
- integration failure.

Presentation maps to safe Problem Details.
