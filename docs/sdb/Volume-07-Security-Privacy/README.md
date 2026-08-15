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
# Volume 07 — Security & Privacy

Este volumen define el baseline de seguridad y privacidad de SIGAC.

SIGAC administra datos personales vinculados con expedientes clínicos y metadatos operativos de su custodia. Aunque el MVP evita almacenar contenido clínico, los identificadores de pacientes, existencia de expedientes, servicios, usuarios, ubicaciones y trazabilidad siguen requiriendo controles estrictos.

## Baseline propuesto

- OWASP ASVS 5.0 como catálogo técnico de verificación.
- OWASP Top 10:2025 como referencia de riesgo de aplicaciones web.
- NIST SP 800-207 como referencia de principios Zero Trust.
- Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados vigente.
- NOM-004-SSA3-2012 y marco archivístico ya incorporado al SDB.

## Objetivo de assurance

**Target engineering baseline: ASVS Level 2**, sujeto a mapeo final y pruebas. Para controles críticos de autenticación, autorización, aislamiento de tenant, auditoría y secretos se aplicarán requisitos reforzados.

Este volumen es de ingeniería y privacidad; no sustituye dictamen jurídico, análisis institucional ni Documento de Seguridad formal exigible.
