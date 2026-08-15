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
# ENG-005 — Code Ownership

Owners candidate:
- architecture;
- security;
- database/migrations;
- frontend design system;
- each domain module.

CODEOWNERS puede requerir revisión adicional para:
- auth;
- tenancy;
- audit;
- migrations;
- deployment.
