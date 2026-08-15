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
# DAT-028 — ERD

```mermaid
erDiagram
  EXPEDIENTES ||--o{ SOLICITUDES : requires
  EXPEDIENTES ||--o{ PRESTAMOS : loaned
  EXPEDIENTES ||--o{ INCIDENCIAS : has
  EXPEDIENTES ||--o{ EXPEDIENTE_MOVIMIENTOS : moves
  JORNADAS_PREPARACION ||--o{ ITEMS_PREPARACION : contains
  SOLICITUDES ||--o| ITEMS_PREPARACION : planned
  PRESTAMOS ||--o{ PRESTAMO_RENOVACIONES : renewed
  INCIDENCIAS ||--o{ INCIDENCIA_ACCIONES : actions
  AGENDA_IMPORTS ||--o{ AGENDA_STAGING_ROWS : rows
  UBICACIONES ||--o{ EXPEDIENTE_MOVIMIENTOS : origin_destination
```

Conceptual physical ERD; fields documented separately.
