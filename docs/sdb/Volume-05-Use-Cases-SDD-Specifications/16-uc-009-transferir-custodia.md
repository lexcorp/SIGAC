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
# UC-009 — Transferir Custodia

## Objetivo
Registrar cambio del responsable operativo.

## Entradas
expediente, custodio origen, custodio destino, ubicación destino, finalidad, fecha/hora.

## Flujo
1. Validar custodia actual.
2. Validar receptor autorizado.
3. Crear transferencia.
4. Actualizar custodia actual.
5. Emitir CustodyTransferred.

## Invariante
No deben coexistir custodias activas incompatibles.
