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
# SPEC-007 — Devolución & Rearchivo

FR-RET-001 recibir devolución.
FR-RET-002 registrar quien devuelve/recibe.
FR-RET-003 verificar condición permitida.
FR-RET-004 cerrar préstamo.
FR-RET-005 confirmar rearchivo.
FR-RET-006 registrar incidencia si aplica.

```gherkin
Scenario: Devolución sin rearchivo inmediato
 Given un expediente es devuelto
 When Archivo registra ReturnReceived
 Then el expediente aparece pendiente de rearchivo
 And no se muestra aún como Disponible en anaquel
```
