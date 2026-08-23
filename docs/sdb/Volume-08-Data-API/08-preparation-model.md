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
# DAT-008 — Preparation

`jornadas_preparacion`
- id
- fecha
- turno
- estado
- source_agenda_import_id
- created_at
- closed_at

`items_preparacion`
- id
- jornada_id
- solicitud_id
- expediente_id
- especialidad_id
- consultorio_id
- hora_cita
- estado
- assigned_to_ref
- located_at
- prepared_at
- late_added boolean

Unique candidate:
(jornada_id, solicitud_id)

## Agenda Preparation read projection v0.1.7

La lista inicial de Agenda Preparation es una proyección distinta de
`JornadaPreparacion`; no introduce turno, consultorio, solicitud ni estado físico.
`PreparationItem` contiene sólo FOLIO, nombre, referencia de Expediente original/resuelta,
tipo de derechohabiente/consulta, fecha/hora, médico y Servicio/Especialidad.

Agrupa Servicio (`nombre`, `codigo`) y médico (`nombre`, `numeroEmpleado`) ASC. Dentro
del médico usa `APPOINTMENT_TIME_ASC` —default, hora/FOLIO— o `PATIENT_NAME_ASC`
—nombrePaciente/FOLIO—. Pantalla e impresión conservan la misma secuencia. Pantalla usa
cursor opaco ligado al order; impresión recupera la colección vigente completa sin
cursor y requiere `AGENDA_VIEW`.

## Agenda Preparation physical model v0.1.8

Aprobado por `PHYSICAL-SCHEMA-DECISION.md` (PHY-AP-001..018).

Tablas tenant-local: `agenda_imports`, `agendas`, `citas`, `agenda_registros`,
`agenda_incidencias`, `agenda_artifact_metadata`, `agenda_idempotency_keys`.

Identidad lógica de Agenda: `(database, agenda_date)`; PK física `agenda_date` en tabla
tenant-local. No existe `AgendaId` Domain.

Identidad de Cita: PK compuesta `(agenda_date, folio)`. Historia preservada mediante
columna `lifecycle` (`ACTIVA` / `RETIRADA_DE_AGENDA`); no se eliminan filas.

`agenda_registros` usa columnas normalizadas para originalValues e interpretedValues
(no JSONB abierto); allow-list cerrada directamente consultable.

Fingerprint almacenado en `agenda_artifact_metadata` separado de `agenda_imports`.
`agenda_idempotency_keys` almacena key → importacion_id; replay reconstruye respuesta
desde tablas canónicas.

Indexes mínimos aprobados en PHY-AP-010. Collation usa default de database institucional
(PHY-AP-011). Migration strategy forward-only en PHY-AP-015.
