---
project: SIGAC
sdb_volume: "04 - Workflows & Event Storming"
version: "0.1.0"
status: "Draft for workflow validation"
date: "2026-08-13"
methodology:
  - Event Storming
  - Domain-Driven Design
  - Spec-Driven Development
---
# Workflow → Domain Map

WF-001 usa Solicitud + JornadaPreparacion + Agenda.
WF-002 usa JornadaPreparacion + Expediente + Solicitud.
WF-003 usa Expediente + Solicitud.
WF-004 usa Expediente + Solicitud + Incidencia.
WF-005 usa Expediente + Custodia + Movimiento.
WF-006 usa Prestamo + Expediente.
WF-007 usa Prestamo + Expediente + Incidencia.
WF-008 usa Expediente + Ubicacion + Movimiento.
WF-009 usa Incidencia + Expediente.
WF-010 usa Solicitud + JornadaPreparacion.
WF-011 usa Prestamo.
WF-012 impacta todos pero pertenece a operación/arquitectura.
