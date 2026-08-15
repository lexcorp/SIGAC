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
# ENG-069 — Architecture Compliance

Automated checks candidate:
- domain cannot import NestJS/ORM;
- module forbidden imports;
- no raw cross-module SQL;
- TenantContext required in repositories;
- public API OpenAPI coverage;
- critical commands require audit;
- secrets scan;
- migrations present for schema changes.
