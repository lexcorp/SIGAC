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
# API-011 — Expedientes

GET /expedientes/{id}
GET /expedientes?numero=...
GET /expedientes/{id}/timeline
GET /expedientes/{id}/current-custody
GET /expedientes/{id}/active-loan
POST /expedientes/{id}/custody-transfers
POST /expedientes/{id}/rearchive

No endpoint edits clinical content.
