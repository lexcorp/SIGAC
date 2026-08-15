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
# ENG-001 — Repository Layout

```text
SIGAC/
├── apps/
│   ├── api/
│   ├── worker/
│   └── web/
├── packages/
│   ├── domain-kernel/
│   ├── modules/
│   │   ├── archive-operations/
│   │   ├── requests/
│   │   ├── preparation/
│   │   ├── loans/
│   │   ├── incidents/
│   │   └── reference-data/
│   ├── platform/
│   │   ├── tenant/
│   │   ├── audit/
│   │   └── auth/
│   └── integrations/
│       └── simef/
├── specs/
├── docs/
├── migrations/
├── tests/
├── tooling/
└── .github/
```

Monorepo recomendado para simplificar consistencia de tipos, tooling y releases.
