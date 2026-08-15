---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.1.0"
status: "Draft for use-case/spec validation"
date: "2026-08-13"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# UC-004 — Asignar Solicitud

## Objetivo
Asignar responsabilidad operativa de atención.

## Flujo
1. Seleccionar solicitud pendiente.
2. Seleccionar/asumir archivista.
3. Validar transición.
4. Marcar Asignada.
5. RequestAssigned.
6. Auditar actor y timestamp.

## Acceptance
Given una solicitud Pendiente
When un archivista autorizado la toma
Then queda Asignada a ese archivista
And se conserva quién/cuándo.
