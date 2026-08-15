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
# ARC-018 — SIMEF Integration

## Phase 1
Excel/file import through an Anti-Corruption Layer.

Pipeline:
upload → validate → normalize → fingerprint → staging → reconcile → commit domain changes → report errors.

## Phase 2
If authorized, connector/API integration reuses the same normalized contract.

## Rule
SIMEF column names and statuses never become domain primitives directly.
