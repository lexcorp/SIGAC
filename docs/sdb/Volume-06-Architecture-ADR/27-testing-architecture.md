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
# ARC-027 — Testing Architecture

Pyramid:
- domain unit tests;
- application use-case tests;
- repository integration tests with PostgreSQL;
- authorization tests;
- tenant-isolation tests;
- API contract tests;
- end-to-end critical workflows;
- migration tests;
- backup/restore drills.

Critical invariant tests must exist before feature release.
