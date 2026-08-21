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
# ARC-015 — Authorization

## Layers
1. Route authentication.
2. Coarse RBAC permission.
3. Tenant/hospital scope.
4. Domain/context policy.
5. Audit.

Example:
A user may have LOAN_OPEN, but opening a particular loan may still require an allowed request type and authorization path.

## Enforcement
Backend guards + application policy checks. Frontend permissions are convenience only.

Para Expediente Workspace, `EXPEDIENT_VIEW` permite Workspace/Timeline y
`EXPEDIENT_AUDIT_VIEW` permite query/tab Auditoría. La segunda no es capability y la UI
no la deriva de roles. OQ-EW-003 queda RESOLVED.

`LOCATION_VIEW` autoriza exclusivamente `ListUbicaciones` y GET
`/api/v1/ubicaciones`. Es distinta de `EXPEDIENT_VIEW`, `EXPEDIENT_AUDIT_VIEW` y
`ADMIN_CONFIGURE`, no es capability y se evalúa server-side antes del query tenant-scoped.

GET `/api/v1/session` es el boundary canónico para que frontend reciba permissions ya
resueltas. No autoriza operaciones por sí mismo ni mezcla permissions generales con
capabilities contextuales. La UI no inspecciona roles.

## Agenda Preparation

Application usa `AGENDA_IMPORT`, `AGENDA_VIEW` y `AGENDA_INCIDENT_VIEW` desde el
RequestContext canónico, sin autorización por rol ni `capabilities[]`. La frontera genera
`ImportAttemptId` antes de autorización/lectura, pero éste no forma parte de RequestContext.
