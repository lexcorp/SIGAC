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
# SEC-020 — MFA

Baseline:
- obligatorio para administradores y roles privilegiados;
- recomendado para todos los usuarios cuando IdP/institución lo permita;
- step-up candidate para acciones críticas futuras.

Métodos y recuperación pertenecen al IdP, no se implementan ad hoc en SIGAC.
