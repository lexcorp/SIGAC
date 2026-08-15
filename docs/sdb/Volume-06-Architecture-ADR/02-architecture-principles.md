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
# ARC-002 — Architecture Principles

1. **Modular first, distributed later only with evidence.**
2. **Domain at the center.**
3. **Dependencies point inward.**
4. **Database is an implementation detail of the domain.**
5. **Tenant isolation is defense-in-depth.**
6. **Authentication is externalized; authorization remains domain-aware.**
7. **Auditability is designed, not added later.**
8. **No hidden cross-module database writes.**
9. **External systems enter through adapters/ACL.**
10. **Backward-compatible migrations by default.**
11. **No clinical data collection without an explicit requirement.**
12. **DEMO can never share operational data with production tenants.**
