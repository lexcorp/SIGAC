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
# API-012 — Solicitudes

POST /solicitudes
GET /solicitudes/{id}
GET /solicitudes
POST /solicitudes/{id}/assign
POST /solicitudes/{id}/start-search
POST /solicitudes/{id}/mark-located
POST /solicitudes/{id}/mark-not-located
POST /solicitudes/{id}/prepare
POST /solicitudes/{id}/cancel
