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
# ARC-024 — Configuration & Secrets

Configuration categories:
- global platform;
- tenant/hospital;
- environment;
- secret.

Secrets never committed to git.

Examples tenant configuration:
- display name;
- branding;
- request types;
- allowed locations;
- loan policies where legally configurable;
- feature flags.

Normative invariants cannot be disabled by tenant configuration.
