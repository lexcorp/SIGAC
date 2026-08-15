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
# UC-010 — Abrir Préstamo

## Objetivo
Formalizar una salida que requiera préstamo.

## Flujo
1. Validar tipo de solicitud y autorización.
2. Validar expediente disponible para préstamo.
3. Registrar solicitante/custodio/finalidad.
4. Aplicar LoanDeadlinePolicy.
5. Crear préstamo Activo.
6. Emitir LoanOpened.

## Important
24h es política aplicable observada, no constante universal.
