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
# ENG-015 — Unit of Work

Application command executes under one tenant DB transaction.

UnitOfWork port:
- begin;
- commit;
- rollback;
- repositories within same transaction.

No distributed transaction across tenant DB and control DB.
