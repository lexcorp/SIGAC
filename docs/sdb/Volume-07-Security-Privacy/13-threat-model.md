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
# SEC-013 — Threat Model

## Assets
Datos de pacientes, ubicación de expedientes, credenciales, tokens, auditoría, tenant routing, backups, llaves, configuraciones.

## Adversaries / failure sources
- usuario interno curioso o malicioso;
- cuenta comprometida;
- atacante externo;
- proveedor/administrador con privilegio excesivo;
- error humano;
- malware/ransomware;
- fallo de integración;
- configuración incorrecta;
- bug cross-tenant.

## Top risks
1. Broken access control.
2. Cross-tenant data leakage.
3. Credential/session theft.
4. Audit tampering.
5. SQL/injection class flaws.
6. Unsafe file import.
7. Secrets exposure.
8. Excessive logging of personal data.
9. Backup theft.
10. Privilege escalation.
