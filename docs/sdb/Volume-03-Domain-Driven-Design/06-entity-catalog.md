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

IMP-AP-001..014 formaliza `IncidenciaImportacion` como objeto hijo identificado y
`RegistroImportadoAgenda` como Entity con evidencia original allow-listed, interpretación,
referencias opacas, un único resultado final e IDs de incidencias. Una fila admite 0..N
incidencias; no se almacena raw irrestricto.
