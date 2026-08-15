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
# ARC-020 — Network & Trust Boundaries

Zones:
- user LAN;
- reverse proxy;
- application network;
- database network;
- identity provider;
- external integrations.

Rules:
- TLS at entry; internal TLS where required by platform;
- PostgreSQL not reachable from user network;
- administrative endpoints restricted;
- outbound access allow-listed where feasible;
- tenant routing occurs server-side.
