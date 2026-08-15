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
# API-020 — Reference Data

GET /ubicaciones
GET /servicios
GET /consultorios
GET /especialidades

Admin mutations:
POST/PATCH only with configuration permission and audit.
