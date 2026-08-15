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
# UC-017 — Gestionar Cita Tardía

## Objetivo
Atender demanda no incluida en preparación inicial.

## Flujo
1. Registrar/detectar nueva cita.
2. Marcar origen tardío.
3. Crear solicitud.
4. Priorizar según política.
5. Buscar.
6. Preparar.
7. Medir impacto.

## Acceptance
La cita tardía no debe perder trazabilidad por no estar en la agenda original.
