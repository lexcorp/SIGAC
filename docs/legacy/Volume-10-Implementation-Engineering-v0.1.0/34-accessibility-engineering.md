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
# ENG-034 — Accessibility Engineering

Automate:
- semantic roles;
- accessible names;
- contrast checks candidate;
- axe-like testing;
- keyboard flows.

Manual:
- focus order;
- screen reader critical workflows;
- high zoom.
