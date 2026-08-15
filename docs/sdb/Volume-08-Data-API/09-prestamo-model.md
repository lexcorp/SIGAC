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
# DAT-009 — Prestamo

- id
- expediente_id
- solicitud_id nullable
- tipo
- finalidad
- solicitante_ref
- custodio_ref
- destino_tipo
- destino_ref
- opened_at
- due_at
- fuente_habilitante_salida
- returned_at
- closed_at
- estado
- row_version

`fuente_habilitante_salida` registra uno de `CONSULTA_PROGRAMADA`,
`VALE_ARCHIVO_SM_1_14`, `ORDEN_SUPERIOR`. Es necesario para SPEC-006 y para la
proyección de préstamo activo de UC-018; no modifica la política fail-closed de
`ORDEN_SUPERIOR` para T-04.

`prestamo_renovaciones`
- id
- prestamo_id
- previous_due_at
- new_due_at
- reason
- authorized_by_ref
- created_at
