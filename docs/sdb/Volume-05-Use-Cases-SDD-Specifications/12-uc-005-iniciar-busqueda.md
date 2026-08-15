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
# UC-005 — Iniciar Búsqueda

## Objetivo
Registrar inicio formal del trabajo de localización.

## Flujo
1. Ver situación actual del expediente.
2. Registrar SearchStarted.
3. Estado solicitud = EnBusqueda.
4. Mostrar ubicación esperada, custodia, préstamos e incidencias.

## Acceptance
Then el tiempo de búsqueda puede medirse desde SearchStarted hasta resultado.
