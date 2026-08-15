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
# ADR Index

- ADR-0001-modular-monolith — **Accepted** — Use a modular monolith
- ADR-0002-clean-architecture — **Accepted** — Use Clean Architecture inside modules
- ADR-0003-typescript-node-nestjs — **Accepted** — Use TypeScript + Node.js LTS + NestJS for backend
- ADR-0004-react-vite — **Accepted** — Use React + TypeScript + Vite for web UI
- ADR-0005-postgresql — **Accepted** — Use PostgreSQL as primary relational database
- ADR-0006-rest-openapi — **Accepted** — Use REST/JSON with OpenAPI
- ADR-0007-multitenancy-db-per-tenant — **Accepted** — Use control plane + logical database per tenant
- ADR-0008-demo-as-tenant — **Accepted** — Model DEMO as isolated tenant with own database
- ADR-0009-oidc — **Accepted** — Use OpenID Connect/OAuth2 for authentication
- ADR-0010-keycloak-reference — **Proposed** — Use Keycloak when no institutional IdP exists
- ADR-0011-rbac-contextual-authz — **Accepted** — Use RBAC plus contextual/domain authorization
- ADR-0012-no-event-sourcing — **Accepted** — Do not use Event Sourcing for MVP
- ADR-0013-transactional-outbox — **Accepted** — Use Transactional Outbox for durable asynchronous side effects
- ADR-0014-no-message-broker-mvp — **Accepted** — Do not deploy Kafka/RabbitMQ in MVP
- ADR-0015-file-first-simef — **Accepted** — Integrate SIMEF through file import first
- ADR-0016-containerized-deployment — **Accepted** — Deploy application components as Linux containers
- ADR-0017-no-kubernetes-initially — **Accepted** — Do not require Kubernetes for first deployment
- ADR-0018-audit-separate-from-domain-events — **Accepted** — Separate audit log, domain events and expediente movement
- ADR-0019-utc-time — **Accepted** — Store timestamps in UTC and render in hospital timezone
- ADR-0020-opaque-identifiers — **Accepted** — Use opaque technical IDs while preserving institutional expediente number
- ADR-0021-tenant-routing-server-side — **Accepted** — Resolve tenant server-side before business operations
- ADR-0022-rls-defense-in-depth — **Proposed** — Use PostgreSQL RLS only for genuinely shared tenant-scoped tables
