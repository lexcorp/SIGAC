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
# SEC-003 — Data Classification

## C0 Public
Documentación pública del producto.

## C1 Internal
Configuración no sensible, catálogos generales.

## C2 Confidential
Usuarios, roles, inventario operativo, ubicaciones y metadatos internos.

## C3 Restricted / Personal Data
Identificadores de paciente, número de expediente, relaciones paciente-expediente, solicitudes, custodia, préstamos, trazabilidad y cualquier dato que pueda revelar atención o relación asistencial.

## C4 Secrets
Passwords, signing keys, client secrets, DB credentials, recovery keys.

Regla: logs y telemetría no deben elevar innecesariamente información C3/C4.

El archivo SIMEF y sus filas raw son C3. Valores que identifican paciente, Expediente o
relación asistencial son C3. Fingerprint, layout y conteos sanitizados son metadata C2 y
no deben permitir reconstruir contenido.
