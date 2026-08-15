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
# SEC-035 — Encryption

## In transit
HTTPS/TLS for browser entry. TLS for service/database links according to trust boundary and platform requirements.

## At rest
- encrypted backup storage mandatory;
- disk/database encryption according to institutional platform;
- application-level field encryption only when threat model justifies it.

Avoid custom cryptography.
