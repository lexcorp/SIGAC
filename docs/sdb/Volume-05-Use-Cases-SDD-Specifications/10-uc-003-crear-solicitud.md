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
# UC-003 — Crear Solicitud

## Objetivo
Registrar una necesidad autorizada de disponer de un expediente.

## Entradas candidatas
Expediente/paciente, origen, tipo, fecha requerida, servicio, consultorio, solicitante, prioridad, observación.

## Flujo
1. Validar permiso.
2. Resolver expediente.
3. Detectar solicitud activa compatible/duplicada.
4. Crear solicitud.
5. Estado = Pendiente.
6. Emitir RequestCreated.

## Alternos
- expediente no existe;
- solicitud duplicada;
- datos insuficientes;
- origen no autorizado.
