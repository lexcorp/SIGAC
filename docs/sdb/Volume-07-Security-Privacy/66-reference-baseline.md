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
# Security Reference Baseline — 2026-08-13

## OWASP
- ASVS 5.0.0 is the current major ASVS baseline used by this SDB.
- OWASP Top 10:2025 is used as awareness/risk reference.
- OWASP Cheat Sheet Series informs implementation patterns for sessions, secrets and other controls.

## NIST
- SP 800-207 provides Zero Trust architectural principles: do not grant implicit trust solely based on network location.

## Mexico
- Current LGPDPPSO text consulted for this volume is the law published in 2025 with reform reflected through 14-Nov-2025.
- The law requires administrative, physical and technical security measures and risk-aware security management.
- Existing public-sector guidance on security/privacy is useful as implementation support, but institutional counsel must validate current competent authority, procedures and applicability.

## SIGAC
The strongest controls are driven by:
- public-sector context;
- sensitive relation to clinical expedientes;
- multi-tenant goal;
- operational auditability.
