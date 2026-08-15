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
# ENG-035 — Migration Workflow

Every schema change:
1. migration file;
2. migration test;
3. empty DB test;
4. representative tenant upgrade test;
5. rollback/forward strategy documented.

Production migration is not generated ad hoc at deploy time.
