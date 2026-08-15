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
# SEC-060 — AI / Codex Security Guardrails

Codex MUST:
- use existing authz policies;
- add tests for sensitive changes;
- preserve tenant context;
- avoid sensitive logs;
- use parameterized persistence adapters;
- validate uploads;
- keep secrets external;
- respect approved crypto libraries/patterns.

Codex MUST NOT:
- create custom authentication;
- disable MFA/security headers for convenience;
- add wildcard CORS with credentials;
- use `tenant_id` from request without server validation;
- bypass repositories to query another tenant;
- copy production data to fixtures;
- log tokens or patient payloads;
- accept insecure defaults to “make demo work”.
