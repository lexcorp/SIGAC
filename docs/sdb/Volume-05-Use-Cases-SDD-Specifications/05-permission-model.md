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
LOAN_OPEN
LOAN_RENEW
RETURN_RECEIVE
REARCHIVE_CONFIRM
INCIDENT_OPEN
INCIDENT_RESOLVE
EXPEDIENT_VIEW
REPORT_VIEW
ADMIN_CONFIGURE
