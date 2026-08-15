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
# ENG-012 — Infrastructure Layer

Implements:
- PostgreSQL repositories;
- tenant connection factory;
- OIDC adapter;
- SIMEF import adapter;
- outbox processor;
- audit store;
- file storage/staging;
- observability adapters.
