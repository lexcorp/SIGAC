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
# ARC-025 — Performance & Scalability

The reported workload is modest for a relational system but latency matters operationally.

Targets to validate:
- common expediente search P95 < 1 s on LAN under normal load;
- command responses P95 < 1 s excluding large imports;
- agenda imports run asynchronously when large;
- dashboard projections avoid N+1 queries;
- indexed search on expediente identifiers/name fields permitted.

Scale-up first. Scale-out only when measurements demand it.
