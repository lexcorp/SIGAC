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
# SPEC-004 — No Localizado & Incidencias

FR-INC-001 registrar intento fallido.
FR-INC-002 reintentar.
FR-INC-003 escalar.
FR-INC-004 abrir incidencia.
FR-INC-005 resolver.
FR-INC-006 declarar extraviado solo con política/autorización.

```gherkin
Scenario: Primer intento fallido
 When un archivista marca NoLocalizado
 Then no se declara Extraviado
 And la solicitud permanece trazable
```
