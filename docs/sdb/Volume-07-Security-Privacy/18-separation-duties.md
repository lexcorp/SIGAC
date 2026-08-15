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
# SEC-018 — Separation of Duties

Candidates:
- quien administra roles no debería modificar auditoría;
- quien opera backup no obtiene automáticamente permiso funcional;
- declaración de Extraviado puede requerir aprobación superior;
- cambios de configuración crítica requieren rol elevado;
- acceso técnico a DB no equivale a autorización de negocio.

Validar según tamaño real del equipo.
