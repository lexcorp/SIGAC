---
project: SIGAC
sdb_volume: "07 - Security & Privacy"
version: "0.1.0"
status: "Draft for security/privacy validation"
date: "2026-08-13"
baseline:
  - OWASP ASVS 5.0
  - OWASP Top 10 2025
  - NIST SP 800-207
  - LGPDPPSO vigente
  - NOM-004-SSA3-2012
---
# SEC-024 — API Security

- auth mandatory by default;
- authorization in application layer;
- schema validation;
- mass-assignment prevention;
- pagination limits;
- object-level authorization;
- tenant context before repository access;
- idempotency for imports/commands selected;
- safe error responses;
- OpenAPI contract tests.
