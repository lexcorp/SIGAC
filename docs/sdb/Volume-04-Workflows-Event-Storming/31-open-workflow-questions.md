---
project: SIGAC
sdb_volume: "04 - Workflows & Event Storming"
version: "0.2.0"
status: "Draft for workflow validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-WF-001, OQ-WF-002 cerradas"
methodology:
  - Event Storming
  - Domain-Driven Design
  - Spec-Driven Development
---
# Open Workflow Questions

## Cerradas (2026-08-14)

| OQ | Pregunta | Resolución |
|----|----------|------------|
| OQ-WF-001 | Punto exacto de inicio de custodia | RESOLVED — custodia externa inicia con `CustodyAccepted` (receptor confirma recepción). El despacho (`ExpedienteDispatched`) es el inicio del traslado, no de la custodia. Ver WF-005, DDD-018. |
| OQ-WF-002 | Receptor formal en consulta | RESOLVED — el receptor puede ser Enfermería o médico/solicitante autorizado. La acción `AcceptCustody` es autenticada y auditable. Ver WF-005, SRC-INT-002. |

## Abiertas

OQ-WF-003 Cierre de Solicitud: ¿en qué momento exacto cierra?
OQ-WF-004 Tratamiento de no-show: ¿qué ocurre si el servicio no recibe el expediente?
OQ-WF-005 Regla de extraviado: ¿qué autoridad y proceso formal se requieren?
OQ-WF-006 TOMO/Provisional dentro del flujo.
OQ-WF-007 Autorización de renovaciones para préstamos extraordinarios.
OQ-WF-008 Regularización de salidas sin registro previo.
OQ-WF-009 Reconciliación después de contingencia.
OQ-WF-010 Cierre de Jornada: ¿por fecha, turno o consultorio?
