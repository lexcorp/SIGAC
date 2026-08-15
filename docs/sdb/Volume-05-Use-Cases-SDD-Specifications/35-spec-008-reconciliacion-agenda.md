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
# SPEC-008 — Reconciliación de Agenda

FR-AGEN-001 importar versión.
FR-AGEN-002 idempotencia.
FR-AGEN-003 detectar altas/bajas/cambios.
FR-AGEN-004 detectar citas tardías.
FR-AGEN-005 preservar trabajo ejecutado.
FR-AGEN-006 reportar errores de filas.

```gherkin
Scenario: Misma agenda dos veces
 Given ya se importó una agenda con fingerprint X
 When se vuelve a importar X
 Then no se crean solicitudes duplicadas
```
