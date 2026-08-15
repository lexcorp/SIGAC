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
# SEC-034 — Secrets Management

Secrets include:
DB credentials, OIDC secrets, signing/encryption keys, backup credentials, API credentials.

Rules:
- never commit;
- inject at deployment;
- separate per environment;
- rotate;
- revoke after compromise;
- restrict CI/CD identities;
- audit secret administration;
- redact from logs/errors.
