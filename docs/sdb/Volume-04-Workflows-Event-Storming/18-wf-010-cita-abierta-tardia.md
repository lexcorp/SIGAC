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
# WF-010 — Cita Abierta / Solicitud Tardía

## Trigger
Paciente/cita no estaba en la preparación inicial.

## Flujo
1. Detectar demanda tardía.
2. CreateRequest.
3. Marcar como tardía/no planificada.
4. Asignar prioridad según política.
5. Iniciar búsqueda inmediata.
6. Seguir WF-003.
7. Reflejar impacto en jornada/indicadores.

## Objetivo
No perder trazabilidad por “saltarse” la agenda original.
