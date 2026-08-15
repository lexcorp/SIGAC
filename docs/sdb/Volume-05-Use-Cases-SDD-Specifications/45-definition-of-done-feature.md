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
# Definition of Done — Feature

Una feature está Done cuando:
- implementación satisface spec;
- acceptance tests pasan;
- unit/domain tests pasan;
- autorización probada;
- auditabilidad probada;
- errores de dominio cubiertos;
- migrations/documentación incluidas si aplican;
- trazabilidad Spec→Test→Code actualizada;
- no rompe reglas multi-tenant/tenant isolation;
- revisión funcional aceptada.
