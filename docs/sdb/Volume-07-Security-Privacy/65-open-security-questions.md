---
project: SIGAC
sdb_volume: "07 - Security & Privacy"
version: "0.2.0"
status: "Draft for security/privacy validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-SEC-011 parcialmente resuelta vía OQ-EW-001/007"
baseline:
  - OWASP ASVS 5.0
  - OWASP Top 10 2025
  - NIST SP 800-207
  - LGPDPPSO vigente
  - NOM-004-SSA3-2012
---
# Open Security & Privacy Questions

## Parcialmente resuelta (2026-08-14)

OQ-SEC-011 Which fields are considered minimum patient identifiers?
  PARTIAL — confirmado que `expedienteNumero` (RFC+COD), nombre del derechohabiente,
  CURP y número ISSSTE son los datos mínimos de desambiguación operativa.
  Todos son C3 (datos de carácter personal operativo). El campo exacto de presentación
  en el Workspace (`pacienteRef.displayLabel`) sigue pendiente de confirmación de
  privacidad (OQ-EW-002 en spec). Ver SEC-003, INT-009, DECISION-REGISTER OQ-EW-007.

## Abiertas

OQ-SEC-001 Does hospital have enterprise IdP/MFA?
OQ-SEC-002 Required session idle/absolute timeout?
OQ-SEC-003 Is concurrent login allowed?
OQ-SEC-004 Is there SIEM/Wazuh/central logging standard?
OQ-SEC-005 Required audit retention?
OQ-SEC-006 Required technical log retention?
OQ-SEC-007 RPO/RTO?
OQ-SEC-008 Backup repository and encryption standard?
OQ-SEC-009 Institution's Documento de Seguridad owner?
OQ-SEC-010 Need formal privacy impact evaluation before pilot?
OQ-SEC-012 Can support personnel access tenant data, and under what break-glass process?
OQ-SEC-013 Required vulnerability remediation SLAs?
OQ-SEC-014 Required penetration test before production?
OQ-SEC-015 Approved TLS/certificate infrastructure?
OQ-SEC-016 Whether exports may leave hospital network?
OQ-SEC-017 Physical contingency record handling?
