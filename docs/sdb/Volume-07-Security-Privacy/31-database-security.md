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
# SEC-031 — Database Security

- DB not exposed to user LAN;
- distinct application/migration/backup roles;
- no superuser for application;
- TLS when required by deployment;
- parameterized queries;
- least privilege;
- schema migrations controlled;
- backup access restricted;
- audit privileged DB access at platform level where available.
