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
# ENG-002 — Branching Strategy

Baseline:
- `main`: siempre releasable.
- feature branches cortas.
- pull request obligatorio.
- no long-lived develop branch.

Branch examples:
`feat/spec-003-search`
`fix/loan-concurrency`
`docs/adr-0023`

Releases taggeadas desde main.
