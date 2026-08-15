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
# SEC-027 — CSRF

If browser authentication uses cookies:
- SameSite strategy;
- CSRF token/origin checks for state-changing requests;
- no GET state mutations.

If bearer tokens are used without ambient cookies, reassess threat accordingly.
