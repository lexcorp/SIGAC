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
# API-002 — Resource Map

Resources:
- expedientes
- solicitudes
- jornadas-preparacion
- prestamos
- devoluciones
- incidencias
- agenda-imports
- ubicaciones
- servicios
- consultorios
- reports
- audit (restricted)
- admin/tenants (platform)
