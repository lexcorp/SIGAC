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
# SEC-040 — Rate Limiting & Abuse Controls

Apply stronger limits to:
- login handled by IdP;
- search enumeration;
- exports;
- imports;
- password/admin operations;
- report generation;
- reset DEMO.

Internal LAN origin does not exempt abuse controls.
