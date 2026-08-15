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
# SEC-046 — Secure Configuration

- dev features disabled in production;
- secure defaults;
- configuration schema validated;
- tenant changes audited;
- no default passwords;
- debug endpoints disabled/restricted;
- sample/demo credentials absent in production;
- feature flags cannot disable compliance invariants.
