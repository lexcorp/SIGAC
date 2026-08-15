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
# UC-008 — Preparar Expediente

## Objetivo
Marcar expediente localizado y organizado como listo para entrega.

## Precondición
Expediente localizado o excepción formal.

## Flujo
1. Confirmar consultorio/servicio/horario.
2. Asociar a jornada/paquete.
3. Marcar Preparada.
4. Emitir ExpedientePrepared.

## Acceptance
No puede marcarse preparado un expediente aún NoLocalizado sin excepción documentada.
