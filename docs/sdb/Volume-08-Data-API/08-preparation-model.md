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
