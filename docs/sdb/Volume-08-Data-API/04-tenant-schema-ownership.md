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
| archive_operations | expedientes, expediente_movimientos |
| requests | solicitudes |
| preparation | jornadas_preparacion, items_preparacion |
| loans | prestamos, prestamo_renovaciones |
| incidents | incidencias, incidencia_acciones |
| reference_data | ubicaciones, servicios, consultorios, especialidades |
| integrations | agenda_imports, agenda_staging_rows, agenda_reconciliation |
| reporting_audit | audit_log, outbox_events |
| identity_access | user_refs, role_assignments (si no se delega totalmente) |

Un módulo no escribe tablas propiedad de otro mediante SQL directo.
