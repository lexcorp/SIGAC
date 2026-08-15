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
# SEC-061 — Security Acceptance Gate

A release cannot be promoted until:
- critical/high findings dispositioned;
- authz tests pass;
- tenant isolation tests pass;
- migration/security configuration reviewed;
- secrets scan passes;
- dependency/container scans completed;
- audit controls verified;
- backup path tested per release policy;
- ASVS mapped controls for changed area verified;
- privacy-impact gate evaluated.
