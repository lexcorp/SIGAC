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
# UC-011 — Renovar Préstamo

## Objetivo
Extender préstamo manteniendo historial.

## Flujo
1. Validar préstamo activo/vencido renovable.
2. Validar autorización.
3. Registrar motivo.
4. Conservar límite previo.
5. Establecer nueva fecha límite.
6. Emitir LoanRenewed.
