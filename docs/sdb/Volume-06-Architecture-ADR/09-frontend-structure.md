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
# ARC-009 — Frontend Structure

React SPA organized by feature, not by generic technical folders.

```text
apps/web/src/
├── app/
├── features/
│   ├── expedientes/
│   ├── solicitudes/
│   ├── preparacion/
│   ├── prestamos/
│   ├── devoluciones/
│   ├── incidencias/
│   └── reportes/
├── shared/
└── api/
```

## Principles
- server state separated from UI state;
- permissions affect presentation but backend remains authoritative;
- route-level code splitting;
- accessible keyboard-first workflows;
- operations optimized for barcode scanning later.
- `EXPEDIENT_AUDIT_VIEW` controla Auditoría sin convertirse en capability;
- Dispatch/AcceptCustody dialogs consumen capabilities y contratos API, no reglas;
- opciones de Ubicación proceden de `ListUbicaciones`, nunca de UUID manual.
- permissions de presentación proceden de GET `/api/v1/session`; no se derivan de roles
  ni se mezclan con capabilities contextuales.
