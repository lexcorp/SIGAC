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
# ARC-011 — Data Architecture

## PostgreSQL
Chosen for transactional integrity, relational modeling, indexing, JSONB where justified, and mature operational tooling.

## Data groups
- tenant control metadata;
- operational master/reference data;
- aggregates and transactional records;
- append-oriented movement history;
- audit log;
- outbox;
- read-model helpers/materialized projections where needed.

## Principles
- UUID/ULID-style opaque internal identifiers;
- institutional expediente number kept as domain identifier;
- foreign keys inside tenant DB;
- constraints explícitos sólo cuando están aprobados; `expedientes.expediente_numero`
  permanece no unique hasta profiling SIMEF;
- no soft-delete as a universal pattern;
- retention handled per record type and policy.

El modelo físico tenant de Expediente Workspace se rige por
`POSTGRES-PHYSICAL-MODEL-DECISION.md` DB-EW-001..014. HospitalId se deriva del
TenantContext y no se duplica como columna.
