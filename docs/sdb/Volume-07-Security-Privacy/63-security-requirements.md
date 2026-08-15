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
# Security Requirements Register

SEC-REQ-001 All business endpoints authenticated by default.
SEC-REQ-002 Authorization enforced server-side.
SEC-REQ-003 Tenant scope resolved and verified before data access.
SEC-REQ-004 Privileged accounts require MFA.
SEC-REQ-005 No shared functional accounts.
SEC-REQ-006 Critical actions audited.
SEC-REQ-007 Sensitive fields excluded from logs.
SEC-REQ-008 Secrets excluded from source control.
SEC-REQ-009 Backups encrypted.
SEC-REQ-010 DEMO uses synthetic data.
SEC-REQ-011 File imports validated and isolated.
SEC-REQ-012 Cross-tenant tests mandatory.
SEC-REQ-013 Clinical content excluded unless future approved requirement.
SEC-REQ-014 Admin/config changes auditable.
SEC-REQ-015 Security headers enabled.
SEC-REQ-016 Supported dependencies/runtimes only.
