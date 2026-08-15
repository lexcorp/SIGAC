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
# ENG-026 — Frontend Structure

```text
apps/web/src/
├── app/
├── routes/
├── features/
├── design-system/
├── api/
├── auth/
├── tenant/
├── telemetry/
└── test/
```

Feature folders map to product modules, not technical categories.
