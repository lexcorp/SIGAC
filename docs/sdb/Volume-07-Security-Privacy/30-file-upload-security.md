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
# SEC-030 — File Upload / Agenda Import Security

- allow-list file formats;
- size limits;
- generated server-side filename;
- temporary quarantine/staging;
- never execute uploaded files;
- parse with hardened libraries;
- protect against zip bombs if archives supported;
- reject formulas/macros where not needed;
- validate row/column counts;
- delete staging according to policy;
- malware scanning if institutional tooling exists.

Agenda Preparation no conserva archivo/filas raw después de rechazo, identidad,
confirmación, reconciliación o aborto terminal. No ofrece vista, descarga o recuperación
humana del raw. Filename cliente no se persiste; tenant procede de RequestContext.

El único exterior soportado es `.xls`; extensión/MIME no prueban compatibilidad y la
aceptación requiere HTML ISO-8859 + layout SIMEF reconocido. El límite se aplica durante
streaming. No se aceptan `.xlsx`, `.csv` o `.xlsm`.
