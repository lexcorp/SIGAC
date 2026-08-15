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
# ENG-018 — Outbox Worker

Worker:
1. fetch pending rows;
2. lock/claim safely;
3. process idempotently;
4. increment attempts;
5. record error;
6. mark processed.

Backoff and poison-event handling required.
