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
# WF-003 — Búsqueda y Localización

## Trigger
Solicitud asignada o ítem de preparación pendiente.

## Secuencia
1. SearchStarted.
2. Consultar ubicación registrada.
3. Buscar en ubicación esperada.
4. Si se encuentra, validar número/identidad.
5. MarkLocated.
6. Actualizar situación/ubicación si existía divergencia.
7. Continuar preparación.

## Si no se encuentra
Ir a WF-004.

## Read Models
Ubicación actual, custodia actual, último movimiento, préstamos activos, incidencias.
