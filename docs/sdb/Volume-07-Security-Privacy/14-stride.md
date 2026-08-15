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
# SEC-014 — STRIDE

| Threat | Example | Control |
|---|---|---|
| Spoofing | token robado | OIDC, MFA, session controls |
| Tampering | alterar devolución | authorization, DB constraints, audit |
| Repudiation | negar préstamo | audit + actor + timestamp |
| Information Disclosure | tenant A ve B | DB isolation, authz |
| Denial of Service | import masivo | limits, worker, rate controls |
| Elevation of Privilege | archivista administra roles | RBAC/SoD |
