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
# ARC-004 — C4 Container Architecture

```mermaid
flowchart TB
  B[Browser]
  RP[Reverse Proxy / TLS]
  WEB[React SPA]
  API[NestJS API]
  WORKER[Background Worker]
  CP[(Control DB)]
  TDB[(Tenant PostgreSQL DB)]
  KC[OIDC IdP / Keycloak]
  EXT[SIMEF / Imports]
  OBS[Logs Metrics Traces]

  B --> RP
  RP --> WEB
  RP --> API
  WEB --> API
  API <--> KC
  API --> CP
  API --> TDB
  API --> WORKER
  WORKER --> TDB
  EXT --> API
  API --> OBS
  WORKER --> OBS
```

## Container responsibilities
- Web: experiencia de usuario.
- API: casos de uso, dominio y adapters.
- Worker: outbox, importaciones pesadas y tareas programadas.
- Control DB: tenants, routing y configuración global mínima.
- Tenant DB: datos de negocio de un hospital.
