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
# SPEC-002 — Preparación

FR-PREP-001 crear Jornada.
FR-PREP-002 agrupar por consultorio/especialidad.
FR-PREP-003 asignar ítems.
FR-PREP-004 marcar localizado.
FR-PREP-005 marcar preparado.
FR-PREP-006 mostrar trabajo pendiente.

```gherkin
Scenario: Preparar expediente localizado
 Given el expediente fue localizado
 When el archivista confirma su paquete/consultorio
 Then el ítem queda Preparado
 And se registra ExpedientePrepared
```
