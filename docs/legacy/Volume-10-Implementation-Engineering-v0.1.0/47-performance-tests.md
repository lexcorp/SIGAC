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
# ENG-047 — Performance Tests

Pilot scenarios:
- expediente lookup;
- jornada 500+ items;
- timeline;
- overdue loan query;
- agenda import.

Measure P50/P95/P99 and DB query plans.
