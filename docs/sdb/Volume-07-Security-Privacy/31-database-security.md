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

`audit_log` pertenece a Security / Audit y reside en cada database tenant para permitir
audit success atómico con mutaciones operacionales. Security / Audit proporciona el
AuditWriter transaction-bound; los módulos operacionales no escriben SQL directo en
`audit_log`. El audit standalone de fallos también usa una transacción tenant-local.
