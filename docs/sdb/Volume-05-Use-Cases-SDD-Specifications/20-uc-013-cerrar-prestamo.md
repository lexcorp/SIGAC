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
# UC-013 — Cerrar Préstamo

## Precondición
Devolución recibida o causa formal autorizada.

## Flujo
1. Validar préstamo.
2. Confirmar devolución.
3. Cerrar plazo/custodia asociada.
4. Emitir LoanClosed.
5. Conservar historial.

## Error
No cerrar préstamo sin evidencia de devolución o resolución formal.
