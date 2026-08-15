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
# SEC-017 — RBAC + Contextual Access

Decision:
- RBAC para permiso grueso.
- Policy/context checks para tipo de solicitud, hospital, estado y finalidad.

Authorization tuple:
`subject + permission + tenant + resource + business context`.

Backend siempre vuelve a comprobar autorización.
