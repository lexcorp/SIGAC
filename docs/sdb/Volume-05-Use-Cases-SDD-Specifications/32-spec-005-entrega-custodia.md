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
# SPEC-005 — Entrega & Custodia

FR-CUST-001 registrar receptor.
FR-CUST-002 origen/destino.
FR-CUST-003 fecha/hora.
FR-CUST-004 actualizar custodia actual.
FR-CUST-005 soportar traslados intermedios cuando se validen.

```gherkin
Scenario: Transferencia válida
 Given el expediente está bajo custodia de Archivo
 When se entrega a un receptor autorizado
 Then la custodia actual cambia
 And se registra CustodyTransferred
```
