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
# ARC-026 — Security Architecture

Controls:
- OIDC authentication;
- MFA available through IdP;
- least privilege;
- tenant isolation;
- secure cookies/token handling;
- CSRF/XSS protections as applicable;
- validation at API boundary;
- parameterized SQL/ORM;
- rate limiting for sensitive operations;
- security headers;
- immutable-ish audit;
- encrypted backups;
- secrets management;
- dependency scanning.

Security-sensitive actions require explicit authorization checks in application layer.
