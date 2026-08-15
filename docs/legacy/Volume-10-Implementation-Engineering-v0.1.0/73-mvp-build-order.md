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
# ENG-073 — MVP Build Order

Vertical slices:

1. Expediente lookup/workspace read.
2. Solicitud create/assign/search.
3. Preparation jornada.
4. Located/not located.
5. Custody transfer.
6. Loan.
7. Return/rearchive.
8. Incidents.
9. Agenda import/reconciliation.
10. Reports/audit.
11. Administration.
12. DEMO reset/seed.

Each slice includes backend + UI + tests + audit + docs.
