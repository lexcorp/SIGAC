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
# SPEC-001 — Solicitud & Demanda

## Requirements
FR-REQ-001 crear solicitud.
FR-REQ-002 asignar solicitud.
FR-REQ-003 cancelar conservando historial.
FR-REQ-004 detectar duplicado candidato.
FR-REQ-005 consultar estado.
FR-REQ-006 registrar origen/tipo.

## Acceptance
```gherkin
Scenario: Solicitud creada
 Given un usuario autorizado
 And un expediente identificable
 When crea una solicitud válida
 Then la solicitud queda Pendiente
 And se registra RequestCreated

Scenario: Solicitud duplicada
 Given existe una solicitud activa compatible
 When se intenta crear otra
 Then el sistema advierte o bloquea según política
 And no duplica silenciosamente
```
