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
# ENG-011 — Application Layer

Contains use cases and orchestration.

Responsibilities:
- authorization policy invocation;
- load aggregate;
- execute domain behavior;
- coordinate transaction;
- persist;
- record audit/outbox;
- return application result.

Does not contain presentation formatting.
