---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.1.0"
status: "Draft for data/API validation"
date: "2026-08-13"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# DAT-002 — Database Topology

```mermaid
flowchart TB
 API[SIGAC API]
 CTRL[(sigac_control)]
 A[(sigac_hospital_a)]
 B[(sigac_hospital_b)]
 D[(sigac_demo)]
 API --> CTRL
 CTRL --> A
 CTRL --> B
 CTRL --> D
```

## Control DB
Tenant registry, routing, global configuration mínima y estado de migraciones.

## Tenant DB
Expedientes, solicitudes, preparación, préstamos, incidencias, movimientos, auditoría, outbox y catálogos propios.
