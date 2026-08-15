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
# ARC-007 — Clean Architecture

Por módulo:

```text
module/
├── domain/
│   ├── entities
│   ├── value-objects
│   ├── policies
│   └── events
├── application/
│   ├── commands
│   ├── queries
│   ├── use-cases
│   └── ports
├── infrastructure/
│   ├── persistence
│   ├── messaging
│   └── integrations
└── presentation/
    └── http
```

## Dependency rule
presentation → application → domain  
infrastructure → application/domain through ports.

Domain does not import NestJS, ORM, HTTP or PostgreSQL.
