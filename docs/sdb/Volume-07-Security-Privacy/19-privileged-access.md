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
# SEC-019 — Privileged Access

- cuentas nominativas;
- MFA obligatorio para administradores;
- no compartir admin;
- elevación temporal cuando sea posible;
- registrar cambios de roles/configuración;
- sesiones administrativas con timeout más estricto;
- revisión periódica de privilegios;
- cuentas break-glass controladas y auditadas si se implementan.
