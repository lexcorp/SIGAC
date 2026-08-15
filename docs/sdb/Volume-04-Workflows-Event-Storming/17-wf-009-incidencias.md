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
# WF-009 — Incidencias

## Tipos
No localizado, extraviado, deteriorado, retenido, mal archivado, duplicado, incompleto, salida sin registro, otro.

## Flujo
1. OpenIncident.
2. Clasificar.
3. Asignar responsable.
4. Investigar.
5. Registrar acciones.
6. Escalar si aplica.
7. Resolver.
8. Registrar resolución.
9. Mantener historial.

## Regla
La resolución de una incidencia no borra los hechos que la originaron.
