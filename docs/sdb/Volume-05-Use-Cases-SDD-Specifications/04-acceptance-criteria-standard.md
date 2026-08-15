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
# SDD-004 — Acceptance Criteria Standard

Formato recomendado:

```gherkin
Given <estado inicial>
And <contexto adicional>
When <acción>
Then <resultado observable>
And <invariante / efecto secundario>
```

## Reglas
- describir comportamiento, no implementación;
- no mencionar tabla, framework o endpoint salvo que la spec sea técnica;
- incluir happy path;
- incluir errores de dominio;
- incluir autorización;
- incluir auditabilidad cuando sea crítica;
- incluir idempotencia en integraciones/importaciones.
