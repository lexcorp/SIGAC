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
# DAT-004 — Table Ownership by Module

| Module | Tables |
|---|---|
| archive_operations | expedientes, ubicaciones, movimientos_expediente |
| requests | solicitudes |
| preparation | jornadas_preparacion, items_preparacion |
| loans | prestamos, prestamo_renovaciones |
| incidents | incidencias, incidencia_acciones |
| reference_data | ubicaciones, servicios, consultorios, especialidades |
| integrations | agenda_imports, agenda_staging_rows, agenda_reconciliation |
| reporting_audit | audit_log, outbox_events |
| identity_access | user_refs, role_assignments (si no se delega totalmente) |

`audit_log` reside físicamente en cada database tenant para integridad transaccional,
pero su ownership sigue siendo `reporting_audit`/Security Audit. El registry Drizzle
tenant puede componer schemas exportados por distintos propietarios sin trasladar
ownership ni habilitar SQL cross-module directo.

Un módulo no escribe tablas propiedad de otro mediante SQL directo.
