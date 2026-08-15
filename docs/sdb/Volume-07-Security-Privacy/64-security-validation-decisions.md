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
# Security Validation Decisions

Confirm/adjust:

1. ASVS 5.0 Level 2 as engineering target.
2. MFA mandatory for privileged roles.
3. No shared accounts.
4. DB-per-tenant remains primary isolation.
5. DEMO synthetic-data-only.
6. OIDC Authorization Code + PKCE baseline.
7. Backend authoritative for authorization.
8. Audit separate and append-oriented.
9. Security logs exclude patient payloads/tokens.
10. Encryption mandatory for backups.
11. No custom cryptography.
12. Manual contingency retains security controls.
13. Security acceptance gate blocks critical issues.
14. Privacy-impact gate before material treatment expansion.
15. Formal privacy/legal conclusions stay institutional, not hardcoded.
