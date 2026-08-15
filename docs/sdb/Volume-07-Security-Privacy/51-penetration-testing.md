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
# SEC-051 — Penetration Testing

Before broad production rollout, test at least:
- auth/authz;
- cross-tenant access;
- IDOR;
- privilege escalation;
- injection;
- XSS/CSRF;
- file import;
- session handling;
- admin interfaces;
- business logic around loan/custody;
- audit bypass.

Test data must not expose real patient information unnecessarily.
