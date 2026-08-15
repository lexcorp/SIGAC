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
# ARC-005 — Backend Component Architecture

```mermaid
flowchart LR
 subgraph API[NestJS Application]
   HTTP[HTTP Controllers]
   APP[Application / Use Cases]
   DOM[Domain]
   PORTS[Ports]
   INFRA[Infrastructure Adapters]
   AUD[Audit]
   OUT[Outbox]
 end
 DB[(PostgreSQL)]
 IDP[OIDC]
 EXT[SIMEF]

 HTTP --> APP
 APP --> DOM
 APP --> PORTS
 INFRA --> PORTS
 INFRA --> DB
 INFRA --> IDP
 INFRA --> EXT
 APP --> AUD
 APP --> OUT
```

Para DispatchExpediente, optimistic lock mismatch revierte la UoW mutante completa.
Sólo después del rollback, Application registra audit `conflict` mediante AuditWriter
fuera de esa UoW; no persiste aggregate ni Movimiento.

## Expediente Workspace read model

`GetExpediente` es el compositor server-side de un único `ExpedienteReadModel`.
Application de Expediente Workspace posee los query ports mínimos que consume de
Requests, Loans & Returns e Incidents; estos contratos retornan proyecciones, no
aggregates. El frontend consume el endpoint agregado y no orquesta bounded contexts.

Esta decisión resuelve `OQ-EW-DESIGN-004`. Fuente:
`docs/decisions/expediente-workspace/READ-MODEL-COMPOSITION-DECISION.md`.

## Expediente timeline boundary

Application de Archive Operations posee `ExpedienteTimelineQueryPort`, que devuelve una
proyección cursor-paginated de `MovimientoExpediente` por Expediente y TenantContext.
Movimiento pertenece al mismo módulo y schema tenant que Expediente; el adapter de
persistencia implementa el port. El contrato no consulta ni devuelve `audit_log`.

Controllers no contienen reglas de negocio. Repositories implementan ports definidos hacia el interior.

## Archive Operations Unit of Work

Los commands mutantes usan `ArchiveOperationsUnitOfWork` tenant-scoped. El callback
recibe Repository, MovimientoExpedienteWriter, AuditWriter y un único
operationOccurredAt. Update aggregate + append movimiento + audit success comparten una
transacción PostgreSQL ALL OR NOTHING. Dominio no conoce transacciones.
Application pasa ese instante explícitamente a `Expediente.dispatch`; conforme
DOM-EVENT-001, el aggregate no genera timestamps ni obtiene un Clock.

La implementación PostgreSQL usa `TenantDatabaseRouter` de `packages/platform/database`
para resolver el pool desde un TenantContext previamente validado. La UoW abre una sola
transacción y construye Repository, MovimientoWriter y un AuditWriter ligado al mismo
handle mediante infraestructura Security / Audit. Los tipos de DB no cruzan hacia
Application. Fuente: TENANT-TRANSACTION-AUDIT-DECISION TX-EW-001..012.
