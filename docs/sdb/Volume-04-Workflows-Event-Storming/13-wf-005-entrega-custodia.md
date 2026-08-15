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
# WF-005 — Entrega y Transferencia de Custodia

## Trigger
Expediente preparado y requerido por servicio.

## Secuencia
1. Identificar receptor/destino autorizado.
2. Confirmar expediente.
3. Registrar origen.
4. Registrar destino.
5. Registrar actor que entrega.
6. Registrar receptor/custodio.
7. TransferCustody.
8. Registrar hora.
9. Emitir evidencia digital.

## Resultado
Custodia externa/temporal conocida.

## Nota
Si la operación requiere traslado intermedio, pueden existir múltiples transferencias de custodia.
