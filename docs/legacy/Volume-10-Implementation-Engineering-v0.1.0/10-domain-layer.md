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
# ENG-010 — Domain Layer

Contains:
- aggregates;
- entities;
- value objects;
- domain policies;
- domain errors;
- domain events.

Rules:
- no HTTP;
- no DB;
- no framework decorators;
- deterministic where possible;
- invariants enforced here.
