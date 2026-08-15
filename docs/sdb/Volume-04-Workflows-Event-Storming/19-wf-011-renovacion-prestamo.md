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
# WF-011 — Renovación de Préstamo

## Trigger
Se requiere conservar expediente más allá del plazo.

## Flujo
1. Solicitar renovación.
2. Validar autorización.
3. Registrar motivo.
4. RenewLoan.
5. Conservar plazo original.
6. Calcular nuevo plazo.
7. Mantener historial.

## Resultado
Préstamo sigue activo bajo nueva vigencia documentada.
