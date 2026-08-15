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
# DAT-003 — Control Plane Schema

Tablas candidatas:
- tenants
- tenant_database_routes
- tenant_domains
- tenant_features
- tenant_migration_status
- platform_audit

## Forbidden
No almacenar:
- pacientes;
- expedientes;
- solicitudes;
- préstamos;
- ubicaciones clínicas;
- movimientos de expediente.

Control plane contiene metadatos de plataforma, no negocio clínico-operativo.
