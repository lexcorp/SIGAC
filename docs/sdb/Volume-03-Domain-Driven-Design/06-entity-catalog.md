---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-006 — Entity Catalog
Expediente; Solicitud; Prestamo; JornadaPreparacion; ItemPreparacion; Incidencia; MovimientoExpediente; AgendaVersion (candidate); PacienteReferencia; UsuarioReferencia.

Agenda Preparation: `ImportacionAgenda` y `Agenda` son Aggregate roots; `Cita` y
`RegistroImportadoAgenda` son entities. `ImportIncident` es estado operacional hijo,
distinto de Incidencia de Archive Operations.
