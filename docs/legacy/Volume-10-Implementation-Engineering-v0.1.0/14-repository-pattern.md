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
# ENG-014 — Repository Pattern

Repository ports live inward.

Examples:
ExpedienteRepository
SolicitudRepository
PrestamoRepository
IncidenciaRepository

Methods reflect aggregate needs, not arbitrary table CRUD.
Avoid generic `BaseRepository<T>` that erases domain semantics.
