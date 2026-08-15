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
# API-014 — Prestamos

POST /prestamos
GET /prestamos/{id}
GET /prestamos?estado=ACTIVO
GET /prestamos?estado=VENCIDO
POST /prestamos/{id}/renew
POST /prestamos/{id}/close

Open requires business authorization, not only endpoint permission.
