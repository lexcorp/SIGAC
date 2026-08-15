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
# UC-020 — Consultar Préstamos Vencidos

## Objetivo
Detectar expedientes fuera de plazo.

## Read Model
expediente, solicitante/custodio, destino, salida, vencimiento, días/horas vencido, excepción/renovación.

No debe incluir como vencidos préstamos con excepción vigente correctamente registrada.
