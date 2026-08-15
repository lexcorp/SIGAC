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
# SEC-038 — Audit Integrity

- append-oriented write path;
- application role cannot update/delete audit rows;
- retention policy;
- timestamps server-side;
- actor and tenant mandatory;
- correlation ID;
- privileged export controlled;
- periodic integrity/reconciliation checks candidate.

Cryptographic chaining is optional and requires separate ADR; not required by default.
