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
# API-008 — Filtering & Sorting

Explicit allow-list per endpoint.

Example:
GET /solicitudes?estado=EN_BUSQUEDA&fecha=2026-08-14&consultorioId=...

No arbitrary SQL field/expression passthrough.
