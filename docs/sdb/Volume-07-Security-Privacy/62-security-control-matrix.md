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
# Security Control Matrix

| Control | Prevent | Detect | Recover |
|---|---|---|---|
| OIDC/MFA | X | X | |
| RBAC/context authz | X | X | |
| Tenant DB isolation | X | X | X |
| Audit | | X | |
| Backup | | | X |
| Validation | X | | |
| Monitoring | | X | |
| Secrets management | X | X | X |
| Incident response | | X | X |
