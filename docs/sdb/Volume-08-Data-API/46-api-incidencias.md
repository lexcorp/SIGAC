---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.1.0"
status: "Draft for data/API validation"
date: "2026-08-13"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# API-016 — Incidencias

POST /incidencias
GET /incidencias
GET /incidencias/{id}
POST /incidencias/{id}/actions
POST /incidencias/{id}/escalate
POST /incidencias/{id}/resolve

DeclareLost, if approved, must be a privileged explicit command.
