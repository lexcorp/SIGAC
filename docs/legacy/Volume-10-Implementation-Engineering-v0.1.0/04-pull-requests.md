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
# ENG-004 — Pull Request Standard

PR debe incluir:
- problema/spec;
- alcance;
- decisiones;
- tests;
- migrations;
- API impact;
- security/privacy impact;
- screenshots si UI;
- checklist tenant isolation;
- docs updated;
- rollback notes when relevant.

No aprobar PR con spec drift no explicado.
