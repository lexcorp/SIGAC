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
# ENG-067 — Codex Guardrails

Codex MUST NOT:
- introduce microservices;
- introduce broker/Event Sourcing;
- bypass module ownership;
- place business rules in controllers/UI;
- access tenant DB without TenantContext;
- invent tables outside ownership model;
- log patient payloads;
- use production data in tests;
- weaken security for DEMO;
- mark ADR Accepted;
- silently change OpenAPI.
