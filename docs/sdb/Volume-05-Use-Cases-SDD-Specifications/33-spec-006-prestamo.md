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
# SPEC-006 — Préstamo

FR-LOAN-001 abrir.
FR-LOAN-002 calcular vencimiento por policy.
FR-LOAN-003 consultar activos.
FR-LOAN-004 detectar vencidos.
FR-LOAN-005 renovar.
FR-LOAN-006 cerrar.

```gherkin
Scenario: Préstamo con plazo
 Given el tipo requiere préstamo
 When se abre
 Then queda Activo
 And se calcula fecha límite según política aplicable
```
