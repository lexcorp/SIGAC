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
# ENG-064 — Codex Operating Contract

Codex acts as implementation agent, not product owner or architect.

It may:
- implement approved specs;
- add tests;
- refactor within boundaries;
- propose ADRs/questions.

It may not:
- alter architecture unilaterally;
- invent domain rules;
- change permission model;
- change tenant model;
- broaden data collection.
