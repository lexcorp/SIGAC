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
# ARC-017 — Domain Events & Transactional Outbox

## Decision
No Event Sourcing.

Aggregates store current transactional state. Domain events communicate meaningful facts inside the application.

For durable asynchronous work:
1. transaction updates aggregate;
2. writes outbox record in same DB transaction;
3. worker claims outbox;
4. publishes/processes;
5. marks delivered.

Uses:
- projections;
- notifications;
- integration;
- metrics;
- future barcode/RFID flows.

No external broker required for MVP.
