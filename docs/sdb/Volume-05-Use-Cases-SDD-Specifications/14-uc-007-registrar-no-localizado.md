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
# UC-007 — Registrar No Localizado

## Objetivo
Registrar que el expediente no se encontró en el intento actual.

## Flujo
1. Registrar ubicación revisada.
2. Registrar actor/fecha.
3. Emitir ExpedienteNotLocated.
4. Mantener solicitud abierta.
5. Aplicar política de reintento/escalamiento.

## Non-goal
No declarar Extraviado automáticamente.

## Acceptance
Given un expediente no encontrado
When se registra NoLocalizado
Then sigue existiendo trazabilidad
And no cambia automáticamente a Extraviado.
