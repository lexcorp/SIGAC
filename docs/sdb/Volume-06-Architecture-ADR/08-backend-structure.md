---
project: SIGAC
sdb_volume: "06 - Architecture & ADR"
version: "0.1.0"
status: "Draft for architecture validation"
date: "2026-08-13"
methodology:
  - Clean Architecture
  - Modular Monolith
  - C4 Model
  - Architecture Decision Records
  - Spec-Driven Development
---
# ARC-008 — Backend Structure

```text
apps/api/
apps/worker/
packages/domain-kernel/
packages/modules/archive-operations/
packages/modules/requests/
packages/modules/preparation/
packages/modules/loans/
packages/modules/incidents/
packages/modules/reference-data/
packages/platform/tenant/
packages/platform/audit/
packages/integrations/simef/
```

## Technology baseline
TypeScript on a maintained Node.js LTS line. NestJS provides modules, DI, guards, pipes and HTTP integration without dictating the domain model.

## Application errors

`DomainError` se reserva para invariantes/validaciones de dominio.
`ApplicationError` expresa resultados de Use Cases y usa un code cerrado. Para
Expediente Workspace puede residir en Application de `archive-operations`; no se crea
un package nuevo ni se coloca en `domain-kernel`. Extraerlo posteriormente a un
componente Application compartido es un refactor no bloqueante si aparece reutilización.

La capa API traduce posteriormente los codes a RFC7807; Application no depende de HTTP.
