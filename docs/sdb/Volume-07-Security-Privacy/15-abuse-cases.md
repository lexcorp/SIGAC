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
# SEC-015 — Abuse Cases

AB-001 Buscar pacientes sin finalidad laboral.
AB-002 Exportar grandes volúmenes.
AB-003 Cambiar tenant en request.
AB-004 Cerrar préstamo sin devolución.
AB-005 Alterar ubicación para ocultar pérdida.
AB-006 Eliminar evidencia de auditoría.
AB-007 Subir Excel malicioso.
AB-008 Reutilizar token expirado.
AB-009 Administrador técnico consulta datos sin necesidad.
AB-010 Copiar producción a DEMO.

Cada caso tendrá test o control preventivo/detectivo.
