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
# SEC-022 — Authentication Events

Registrar de forma segura:
- login success/failure;
- logout;
- MFA challenge/failure;
- account disabled;
- role/permission change;
- anomalías de sesión;
- admin login.

No registrar password, access token, refresh token ni secretos.
