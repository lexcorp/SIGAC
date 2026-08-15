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
# DAT-014 — Reference Data

Tables:
- ubicaciones
- servicios
- especialidades
- consultorios
- request_types
- incident_types
- loan_policies

## Configurability
Los catálogos varían por hospital.

`loan_policies` puede parametrizar plazos válidos, pero nunca deshabilitar obligaciones normativas.
