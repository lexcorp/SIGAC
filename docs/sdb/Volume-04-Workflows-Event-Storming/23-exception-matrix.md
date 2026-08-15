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
# Exception Matrix

| Excepción | Workflow afectado | Respuesta TO-BE candidata |
|---|---|---|
| Agenda cambió | WF-001 | Reconciliar |
| No localizado | WF-003 | WF-004 |
| Préstamo vencido | WF-006 | Alertar/escalar |
| Retenido | WF-006/007 | Incidencia |
| Deteriorado | WF-007 | Incidencia |
| Salida sin registro | WF-005 | Regularizar + incidencia |
| Sistema caído | Todos | WF-012 |
| Cita tardía | WF-001/002 | WF-010 |
