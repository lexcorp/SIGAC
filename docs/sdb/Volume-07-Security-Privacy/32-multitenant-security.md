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
# SEC-032 — Multi-Tenant Security

Primary isolation: database-per-tenant.

Controls:
- server-side tenant resolution;
- user→tenant authorization;
- connection pool keyed by tenant;
- no arbitrary DB name from request;
- allow-listed tenant registry;
- tests for cross-tenant IDOR;
- worker/outbox preserves tenant context;
- caches include tenant in key;
- exports scoped to tenant;
- migration runner validates target tenant;
- backup files named/scoped securely.
