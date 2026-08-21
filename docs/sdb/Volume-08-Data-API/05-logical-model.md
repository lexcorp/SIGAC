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
# DAT-005 — Logical Model

Entidades principales:
- Expediente
- PacienteReferencia
- Solicitud
- JornadaPreparacion
- ItemPreparacion
- Prestamo
- PrestamoRenovacion
- Incidencia
- IncidenciaAccion
- MovimientoExpediente
- Ubicacion
- Servicio
- Consultorio
- AgendaImport
- Agenda (identidad lógica tenant database + AgendaFecha; sin AgendaId Domain)
- Cita (FOLIO dentro de Agenda; lifecycle ACTIVA/RETIRADA_DE_AGENDA)
- AuditRecord
- OutboxEvent
