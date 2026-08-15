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
# SPEC-003 — Búsqueda & Localización

FR-SRCH-001 iniciar búsqueda.
FR-SRCH-002 mostrar ubicación/custodia previa.
FR-SRCH-003 registrar localización real.
FR-SRCH-004 registrar discrepancia.
FR-SRCH-005 medir duración.

```gherkin
Scenario: Encontrado en ubicación distinta
 Given la ubicación registrada es A
 When se confirma localización en B
 Then se registra B
 And se conserva la discrepancia como trazabilidad
```
