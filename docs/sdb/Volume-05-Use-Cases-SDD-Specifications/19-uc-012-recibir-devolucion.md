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
# UC-012 — Recibir Devolución

## Objetivo
Registrar regreso físico a Archivo.

## Flujo
1. Identificar expediente.
2. Identificar quien devuelve.
3. Registrar quien recibe.
4. Emitir ReturnReceived.
5. Verificar condición dentro de facultades.
6. Abrir incidencia si corresponde.
7. Pasar a rearchivo/cierre.

## Regla
ReturnReceived != ExpedienteRearchived.
