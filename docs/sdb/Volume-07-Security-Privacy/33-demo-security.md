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
# SEC-033 — DEMO Security

- separate tenant DB;
- synthetic data only;
- independent identities/assignments;
- strong visual DEMO indication;
- no production integrations by default;
- reset privilege restricted;
- reset action audited;
- no production backup restore;
- egress allow-list stricter than production where feasible.
