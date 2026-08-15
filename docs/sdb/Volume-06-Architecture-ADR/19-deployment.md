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
# ARC-019 — Deployment

## Initial reference deployment
Linux host(s) with containers.

```text
reverse-proxy
web
api
worker
keycloak (if used)
postgresql/control
postgresql tenant databases
observability agents
backup jobs
```

## Recommendation
Use Docker/Podman Compose for first hospital unless institutional platform already provides orchestration.

Kubernetes is explicitly deferred until operational evidence justifies it.
