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
# ES-005 — Policies

POL-ES-001 AgendaImported → crear/reconciliar demanda.
POL-ES-002 ExpedienteNotLocated → registrar intento y decidir reintento/escalamiento.
POL-ES-003 ExpedientePrepared → dejar disponible para entrega según jornada.
POL-ES-004 CustodyTransferred → actualizar custodio actual.
POL-ES-005 LoanOpened → calcular fecha límite según política aplicable.
POL-ES-006 Fecha límite superada → LoanExpired.
POL-ES-007 ReturnReceived → cerrar custodia externa y pasar a verificación/rearchivo según flujo.
POL-ES-008 IncidentOpened → asignar responsable/estado.
POL-ES-009 AgendaReconciled con alta tardía → crear nueva demanda y alertar preparación.
