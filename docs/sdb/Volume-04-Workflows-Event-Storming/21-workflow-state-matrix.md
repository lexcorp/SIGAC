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
# Workflow State Matrix

| Workflow | Estado principal |
|---|---|
| Solicitud | Pendiente / Asignada / En búsqueda / Localizada / Preparada / Entregada / Cancelada |
| Expediente | Disponible / Preparación / Traslado / Custodia externa / Recibido / Disponible |
| Préstamo | Activo / Renovado / Vencido / Devuelto / Cerrado |
| Incidencia | Abierta / Investigación / Escalada / Resuelta |
| Jornada | Abierta / En preparación / Lista / En operación / Cerrada |

No todos los estados están aprobados; se validarán en Volume 05.
