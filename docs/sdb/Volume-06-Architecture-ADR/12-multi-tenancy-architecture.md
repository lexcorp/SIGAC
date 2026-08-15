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
# ARC-012 — Multi-Tenancy Architecture

## Decision
**Control plane + database-per-tenant (logical database) for operational business data.**

A PostgreSQL cluster may host multiple tenant databases, but each hospital's operational data resides in its own database.

```mermaid
flowchart TB
 API[SIGAC API] --> CTRL[(sigac_control)]
 CTRL --> R[tenant routing]
 R --> T1[(sigac_hospital_a)]
 R --> T2[(sigac_hospital_b)]
 R --> TD[(sigac_demo)]
```

## Rationale
- strong isolation;
- simpler per-hospital backup/restore;
- reduced risk of cross-tenant query mistakes;
- supports different maintenance windows/configuration;
- DEMO separation is natural.

## Defense-in-depth
Where shared tables are unavoidable, PostgreSQL Row-Level Security may be used in addition to application checks, not instead of isolation.

## Cost
More database lifecycle/migration automation is required.

## TenantDatabaseRouter

`packages/platform/database` resuelve pools exclusivamente desde TenantContext validado
y un registro allow-listed. No autoriza actores, no recibe rutas desde HTTP y no expone
tipos PostgreSQL/Drizzle a Application. Una operación mutante abre como máximo una
transacción en una única database tenant; no hay transacciones cross-tenant.
