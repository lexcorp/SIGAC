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
# UC-014 — Confirmar Rearchivo

## Objetivo
Confirmar que el expediente regresó a una ubicación física válida.

## Flujo
1. Seleccionar/confirmar ubicación.
2. Validar código/ubicación.
3. Registrar colocación.
4. Actualizar ubicación actual.
5. Liberar condición temporal.
6. Emitir ExpedienteRearchived.
