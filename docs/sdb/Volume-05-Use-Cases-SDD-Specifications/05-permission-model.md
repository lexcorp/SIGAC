---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.2.0"
status: "Draft for use-case/spec validation"
date: "2026-08-13"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# SDD-005 — Permission Model

La autorización se modelará como:

`Actor × Acción × Tipo de Solicitud × Contexto × Hospital/Tenant`

## Principio
No asumir que “Médico”, “Enfermería” o “Archivo” tienen permisos universales.

## Acciones candidatas
REQUEST_CREATE
REQUEST_ASSIGN
SEARCH_START
SEARCH_MARK_LOCATED
SEARCH_MARK_NOT_LOCATED
PREPARATION_MARK_READY
CUSTODY_TRANSFER
EXPEDIENT_DISPATCH
CUSTODY_ACCEPT
LOAN_OPEN
LOAN_RENEW
RETURN_RECEIVE
REARCHIVE_CONFIRM
INCIDENT_OPEN
INCIDENT_RESOLVE
EXPEDIENT_VIEW
EXPEDIENT_AUDIT_VIEW
LOCATION_VIEW
REPORT_VIEW
ADMIN_CONFIGURE

## Separación y asignación del Expediente Workspace

`Role != Permission != Capability != Command`.

El mapeo canónico Capability -> Permission y la asignación mínima Role -> Permission
se definen en `docs/decisions/expediente-workspace/AUTHORIZATION-DECISION.md`.
`EXPEDIENT_VIEW` es una permission de lectura y no una capability operativa.
`EXPEDIENT_AUDIT_VIEW` autoriza exclusivamente la consulta sanitizada del audit del
Expediente y el tab Auditoría. Tampoco es capability. OQ-EW-003 queda RESOLVED.
`LOCATION_VIEW` autoriza exclusivamente la consulta/listado del catálogo operativo de
ubicaciones mediante `ListUbicaciones`/GET `/api/v1/ubicaciones`. No es capability y no
se sustituye por `EXPEDIENT_VIEW` ni `ADMIN_CONFIGURE`.
