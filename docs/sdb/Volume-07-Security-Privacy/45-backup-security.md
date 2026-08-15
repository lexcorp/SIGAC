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
# SEC-045 — Backup Security

- encryption;
- restricted accounts;
- immutable/offline copy candidate;
- per-tenant separation;
- restore authorization;
- restore tests;
- backup logs monitored;
- no restoration of production tenant into DEMO.
