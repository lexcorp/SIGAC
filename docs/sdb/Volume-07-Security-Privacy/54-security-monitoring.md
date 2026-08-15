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
# SEC-054 — Security Monitoring

Alert candidates:
- repeated auth failures;
- cross-tenant attempts;
- privilege change;
- unusual exports/search volume;
- audit write failure;
- DEMO reset;
- tenant routing failure;
- malware/upload rejection;
- backup failure;
- excessive 403/401;
- configuration change.

Integrate with existing monitoring/SIEM when available.
