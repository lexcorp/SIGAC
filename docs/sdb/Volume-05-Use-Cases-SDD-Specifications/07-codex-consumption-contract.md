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
# SDD-007 — AI / Codex Consumption Contract

Antes de implementar una spec, Codex debe leer:

1. Volume 01 Foundation
2. Volume 02 Business & Compliance
3. Volume 03 DDD
4. Volume 04 workflow relacionado
5. Spec objetivo
6. ADR técnicos aprobados disponibles
7. tests/acceptance asociados

## Codex MUST
- preservar nombres del lenguaje ubicuo;
- respetar non-goals;
- no inventar permisos;
- no incorporar datos clínicos no solicitados;
- no fusionar Solicitud, Préstamo y Movimiento;
- no convertir DEMO en bandera de dominio;
- no elegir estrategia multi-tenant sin ADR;
- documentar cualquier supuesto nuevo.

## Codex MUST NOT
- implementar desde CONSIDERACIONES.txt sin spec aprobada;
- hardcodear 24h como regla global;
- declarar extraviado automáticamente al primer fallo;
- tratar devolución y rearchivo como el mismo evento.
