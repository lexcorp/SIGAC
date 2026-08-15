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
# ENG-003 — Commit Convention

Conventional Commits candidate:
- feat:
- fix:
- refactor:
- test:
- docs:
- chore:
- build:
- ci:

Cada cambio funcional debe referenciar SPEC/UC cuando aplique.
Ejemplo:
`feat(requests): implement SPEC-001 create request`
