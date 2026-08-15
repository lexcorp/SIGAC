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
# WF-006 — Préstamo

## Trigger
Tipo de salida que requiere préstamo formal.

## Secuencia
1. Validar autorización.
2. OpenLoan.
3. Registrar solicitante.
4. Registrar custodio.
5. Registrar finalidad/destino.
6. Calcular fecha límite.
7. Asociar evidencia/formato cuando aplique.
8. Marcar activo.
9. Monitorear vencimiento.

## Excepciones
Hospitalización, trámites y otras causas autorizadas pueden modificar plazo/política.
