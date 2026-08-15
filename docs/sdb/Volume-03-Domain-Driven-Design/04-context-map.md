---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-004 — Context Map
```mermaid
flowchart LR
 SIMEF[SIMEF/Agenda] --> REQ[Requests]
 REQ --> PREP[Preparation]
 PREP --> ARCH[Archive Operations]
 REQ --> LOAN[Loans & Returns]
 ARCH <--> LOAN
 ARCH --> INC[Incidents]
 PREP --> INC
 LOAN --> INC
 REF[Reference Data] --> ARCH
 IAM[Identity & Access] --> ARCH
 ARCH --> REP[Reporting & Audit]
 REQ --> REP
 LOAN --> REP
 INC --> REP
```

## Proyecciones consumidas por Expediente Workspace

Archive Operations conserva la propiedad del Workspace y consume proyecciones mínimas
de Requests, Loans & Returns e Incidents mediante query ports propiedad del consumidor:
`ActiveRequestQueryPort`, `ActiveLoanQueryPort`, `OpenIncidentsQueryPort` y
`ExitEnablingSourceQueryPort`. Estos puertos no exponen aggregates completos ni cambian
la propiedad de dominio de cada bounded context. Todas sus consultas reciben
`ExpedienteId` y `TenantContext`.

`ExitEnablingSourceQueryPort` devuelve `0..N` contextos mínimos `{ tipo, validada }`.
El provider determina `validada`; el Workspace no consulta evidencia completa.

Fuente: READ-MODEL-COMPOSITION-DECISION, READ-EW-002..012.
