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
# UC-015 — Registrar Incidencia

Tipos candidatos:
NoLocalizado, Deteriorado, Retenido, MalArchivado, Duplicado, Incompleto, SalidaSinRegistro, Extraviado, Otro.

## Flujo
1. Seleccionar expediente.
2. Tipo.
3. Descripción.
4. Evidencia/observación.
5. Responsable.
6. IncidentOpened.

## Restricción
Extraviado puede requerir permiso/política especial.
